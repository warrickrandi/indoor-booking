import { createHash } from 'node:crypto'
import { Prisma } from '@sports-booking/db'
import type { VenueStaffActor, UpgradeSubscriptionBody, BillingCycle } from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { env } from '../lib/env.js'
import { createAuditLog } from '../middleware/audit.js'
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js'
import { addEmailJob } from '../jobs/email.job.js'
import { formatLocalDate } from '../lib/datetime.js'
import { TIER_RANK } from '../middleware/rbac.js'

type InvoiceWithPlan = Prisma.SubscriptionInvoiceGetPayload<{ include: { plan: true } }>
type DbClient = Prisma.TransactionClient

// ─── Date / pricing helpers ─────────────────────────────────────────────────

export function addInterval(date: Date, cycle: BillingCycle): Date {
  const d = new Date(date)
  if (cycle === 'monthly') {
    d.setUTCMonth(d.getUTCMonth() + 1)
  } else {
    d.setUTCFullYear(d.getUTCFullYear() + 1)
  }
  return d
}

function cycleDays(cycle: BillingCycle): number {
  return cycle === 'monthly' ? 30 : 365
}

function diffDaysCeil(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000))
}

function planPrice(plan: { price_monthly: Prisma.Decimal; price_annual: Prisma.Decimal }, cycle: BillingCycle): number {
  return cycle === 'monthly' ? Number(plan.price_monthly) : Number(plan.price_annual)
}

export function formatLKR(amount: number): string {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function inferBillingCycle(start: Date, end: Date): BillingCycle {
  return diffDaysCeil(start, end) >= 180 ? 'annual' : 'monthly'
}

async function findOwner(companyId: string) {
  return prisma.companyMember.findFirst({
    where:   { company_id: companyId, role: { name: 'owner' } },
    include: { user: { select: { email: true, full_name: true } } },
  })
}

// ─── Serialization ───────────────────────────────────────────────────────────

export function serializeInvoice(invoice: InvoiceWithPlan) {
  return {
    id:                   invoice.id,
    plan:                 { name: invoice.plan.name, tier: invoice.plan.tier },
    amount:               Number(invoice.amount),
    currency:             invoice.currency,
    status:               invoice.status,
    billing_period_start: invoice.billing_period_start.toISOString(),
    billing_period_end:   invoice.billing_period_end.toISOString(),
    paid_at:              invoice.paid_at?.toISOString() ?? null,
    created_at:           invoice.created_at.toISOString(),
  }
}

// ─── Public plans ────────────────────────────────────────────────────────────

export async function getPublicPlans() {
  const plans = await prisma.subscriptionPlan.findMany({
    where:   { is_active: true },
    orderBy: { price_monthly: 'asc' },
  })

  return plans.map((plan) => ({
    id:                plan.id,
    name:              plan.name,
    tier:              plan.tier,
    price_monthly:     Number(plan.price_monthly),
    price_annual:      Number(plan.price_annual),
    max_locations:     plan.max_locations,
    trial_period_days: plan.trial_period_days,
    feature_flags:     plan.feature_flags,
  }))
}

// ─── Current subscription ───────────────────────────────────────────────────

export async function getCurrentSubscription(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where:   { id: companyId },
    include: { plan: true, scheduled_plan: true },
  })

  const now = new Date()
  const isTrial = company.trial_ends_at !== null && company.trial_ends_at > now
  const status = company.status === 'suspended'
    ? 'suspended'
    : isTrial
      ? 'trialing'
      : company.scheduled_plan_id !== null
        ? 'cancelling'
        : 'active'
  const cycle = company.billing_cycle as BillingCycle

  return {
    plan:                { id: company.plan.id, name: company.plan.name, tier: company.plan.tier },
    billing_cycle:       company.billing_cycle,
    status,
    current_period_end:  company.subscription_expires_at?.toISOString() ?? null,
    days_until_renewal:  company.subscription_expires_at ? diffDaysCeil(now, company.subscription_expires_at) : null,
    is_trial:            isTrial,
    trial_ends_at:       company.trial_ends_at?.toISOString() ?? null,
    next_invoice_amount: planPrice(company.scheduled_plan ?? company.plan, cycle),
    scheduled_plan:      company.scheduled_plan
      ? { id: company.scheduled_plan.id, name: company.scheduled_plan.name, tier: company.scheduled_plan.tier }
      : null,
  }
}

// ─── Invoices ────────────────────────────────────────────────────────────────

export async function listInvoices(companyId: string) {
  const invoices = await prisma.subscriptionInvoice.findMany({
    where:   { company_id: companyId },
    include: { plan: true },
    orderBy: { created_at: 'desc' },
  })

  return invoices.map(serializeInvoice)
}

// ─── Apply a paid invoice to a company's subscription ──────────────────────

export async function applyInvoicePayment(tx: DbClient, invoice: InvoiceWithPlan): Promise<void> {
  await tx.subscriptionInvoice.update({
    where: { id: invoice.id },
    data:  { status: 'paid', paid_at: new Date() },
  })

  await tx.company.update({
    where: { id: invoice.company_id },
    data: {
      plan_id:                 invoice.plan_id,
      billing_cycle:           inferBillingCycle(invoice.billing_period_start, invoice.billing_period_end),
      subscription_expires_at: invoice.billing_period_end,
      scheduled_plan_id:       null,
      status:                  'active', // reactivate if previously suspended
    },
  })
}

// ─── PayHere checkout for a subscription invoice ───────────────────────────

export function buildSubscriptionCheckout(
  invoice: InvoiceWithPlan,
  company: { id: string; name: string },
  ownerEmail: string,
  ownerName: string,
) {
  const amount = Number(invoice.amount).toFixed(2)
  const currency = 'LKR'

  const hashedSecret = createHash('md5').update(env.PAYHERE_SECRET).digest('hex').toUpperCase()
  const hash = createHash('md5')
    .update(`${env.PAYHERE_MERCHANT_ID}${invoice.id}${amount}${currency}${hashedSecret}`)
    .digest('hex')
    .toUpperCase()

  const nameParts = ownerName.trim().split(/\s+/)
  const firstName = nameParts[0] || 'Customer'
  const lastName = nameParts.slice(1).join(' ')

  return {
    merchant_id: env.PAYHERE_MERCHANT_ID,
    return_url:  `${env.FRONTEND_URL}/settings/billing`,
    cancel_url:  `${env.FRONTEND_URL}/settings/billing`,
    notify_url:  `${env.API_URL}/api/v1/payments/webhook/payhere-billing`,
    order_id:    invoice.id,
    items:       `${company.name} subscription — ${invoice.plan.name} plan`,
    currency,
    amount,
    first_name:  firstName,
    last_name:   lastName,
    email:       ownerEmail,
    phone:       '',
    custom_1:    invoice.id,
    hash,
  }
}

// ─── Upgrade / downgrade / schedule ─────────────────────────────────────────

export async function upgradeSubscription(actor: VenueStaffActor, body: UpgradeSubscriptionBody) {
  const company = await prisma.company.findUniqueOrThrow({
    where:   { id: actor.company_id },
    include: { plan: true },
  })

  const targetPlan = await prisma.subscriptionPlan.findUnique({ where: { id: body.plan_id } })
  if (!targetPlan || !targetPlan.is_active) {
    throw new NotFoundError('Subscription plan')
  }

  const currentPlan = company.plan
  const now = new Date()

  // ─── Downgrade safety checks (apply against the target plan's limits) ────
  if (targetPlan.max_locations !== -1) {
    const activeLocations = await prisma.location.count({
      where: { company_id: company.id, status: 'active' },
    })
    if (activeLocations > targetPlan.max_locations) {
      throw new ValidationError(
        `The ${targetPlan.name} plan supports up to ${targetPlan.max_locations} location(s), but you have ${activeLocations} active`,
        { active_locations: activeLocations, max_locations: targetPlan.max_locations },
      )
    }
  }

  if (targetPlan.tier !== 'elite') {
    const customDomains = await prisma.companyDomain.count({
      where: { company_id: company.id, type: 'custom', is_active: true },
    })
    if (customDomains > 0) {
      throw new ValidationError(
        `Remove your custom domain before switching to the ${targetPlan.name} plan`,
        { custom_domain: true },
      )
    }
  }

  const isDowngrade = TIER_RANK[targetPlan.tier]! < TIER_RANK[currentPlan.tier]!
  const hasActivePeriod = company.subscription_expires_at !== null && company.subscription_expires_at > now

  // ─── Schedule a downgrade for the end of the current period ──────────────
  if (isDowngrade && hasActivePeriod) {
    await prisma.company.update({
      where: { id: company.id },
      data:  { scheduled_plan_id: targetPlan.id },
    })

    await createAuditLog({
      actor_id:    actor.sub,
      actor_type:  'venue_staff',
      company_id:  company.id,
      action:      'billing.upgraded',
      entity_type: 'company',
      entity_id:   company.id,
      after:       { scheduled_plan: targetPlan.name, effective_at: company.subscription_expires_at!.toISOString() },
    })

    return {
      scheduled:    true,
      effective_at: company.subscription_expires_at!.toISOString(),
      plan:         { id: targetPlan.id, name: targetPlan.name, tier: targetPlan.tier },
    }
  }

  // ─── Trial grant (first upgrade from basic only) ──────────────────────────
  const eligibleForTrial =
    currentPlan.tier === 'basic' &&
    !isDowngrade &&
    company.trial_used_at === null &&
    targetPlan.trial_period_days > 0

  if (eligibleForTrial) {
    const trialEndsAt = new Date(now.getTime() + targetPlan.trial_period_days * 86_400_000)

    await prisma.company.update({
      where: { id: company.id },
      data: {
        plan_id:                 targetPlan.id,
        billing_cycle:           body.billing_cycle,
        trial_ends_at:           trialEndsAt,
        trial_used_at:           now,
        subscription_expires_at: trialEndsAt,
        scheduled_plan_id:       null,
      },
    })

    await createAuditLog({
      actor_id:    actor.sub,
      actor_type:  'venue_staff',
      company_id:  company.id,
      action:      'billing.upgraded',
      entity_type: 'company',
      entity_id:   company.id,
      after:       { plan: targetPlan.name, trial_ends_at: trialEndsAt.toISOString() },
    })

    return {
      trial:         true,
      trial_ends_at: trialEndsAt.toISOString(),
      plan:          { id: targetPlan.id, name: targetPlan.name, tier: targetPlan.tier },
    }
  }

  // ─── Immediate upgrade — prorated invoice ─────────────────────────────────
  const remainingDays = hasActivePeriod ? diffDaysCeil(now, company.subscription_expires_at!) : 0
  const credit = hasActivePeriod
    ? (planPrice(currentPlan, company.billing_cycle as BillingCycle) * remainingDays) / cycleDays(company.billing_cycle as BillingCycle)
    : 0

  const fullPrice = planPrice(targetPlan, body.billing_cycle)
  const amount = Math.round(Math.max(0, fullPrice - credit) * 100) / 100

  const periodStart = now
  const periodEnd = addInterval(now, body.billing_cycle)

  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      company_id:           company.id,
      plan_id:              targetPlan.id,
      amount,
      currency:             'LKR',
      status:               'pending',
      billing_period_start: periodStart,
      billing_period_end:   periodEnd,
    },
    include: { plan: true },
  })

  await prisma.company.update({
    where: { id: company.id },
    data:  { scheduled_plan_id: null },
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'venue_staff',
    company_id:  company.id,
    action:      'billing.upgraded',
    entity_type: 'subscription_invoice',
    entity_id:   invoice.id,
    after:       { plan: targetPlan.name, amount, billing_cycle: body.billing_cycle },
  })

  if (amount === 0) {
    await prisma.$transaction((tx) => applyInvoicePayment(tx, invoice))

    const owner = await findOwner(company.id)
    if (owner?.user.email) {
      await addEmailJob(owner.user.email, 'subscription_confirmed', {
        planName:        targetPlan.name,
        billingCycle:    body.billing_cycle,
        nextRenewalDate: formatLocalDate(periodEnd),
        dashboardUrl:    `${env.FRONTEND_URL}/settings/billing`,
      }, { companyId: company.id })
    }

    return { invoice: serializeInvoice(invoice) }
  }

  const owner = await findOwner(company.id)
  const checkoutParams = buildSubscriptionCheckout(
    invoice,
    company,
    owner?.user.email ?? '',
    owner?.user.full_name ?? company.name,
  )

  return { invoice: serializeInvoice(invoice), checkout_params: checkoutParams }
}

// ─── Cancel subscription (schedules downgrade to basic) ─────────────────────

export async function cancelSubscription(actor: VenueStaffActor) {
  const company = await prisma.company.findUniqueOrThrow({
    where:   { id: actor.company_id },
    include: { plan: true },
  })

  if (company.plan.tier === 'basic') {
    throw new ConflictError('Already on the basic plan')
  }

  const basicPlan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { tier: 'basic' } })

  await prisma.company.update({
    where: { id: company.id },
    data:  { scheduled_plan_id: basicPlan.id },
  })

  const accessUntil = company.subscription_expires_at ?? new Date()

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'venue_staff',
    company_id:  company.id,
    action:      'billing.cancelled',
    entity_type: 'company',
    entity_id:   company.id,
    after:       { scheduled_plan: basicPlan.name, effective_at: accessUntil.toISOString() },
  })

  const owner = await findOwner(company.id)
  if (owner?.user.email) {
    await addEmailJob(owner.user.email, 'subscription_cancelled', {
      planName:     company.plan.name,
      accessUntil:  formatLocalDate(accessUntil),
      dashboardUrl: `${env.FRONTEND_URL}/settings/billing`,
    }, { companyId: company.id })
  }

  return { scheduled: true, effective_at: accessUntil.toISOString() }
}

// ─── PayHere billing webhook ────────────────────────────────────────────────

export function verifyPayhereBillingWebhook(payload: Record<string, string>): boolean {
  const hashedSecret = createHash('md5').update(env.PAYHERE_SECRET).digest('hex').toUpperCase()
  const localSig = createHash('md5')
    .update(
      `${payload['merchant_id'] ?? ''}${payload['order_id'] ?? ''}${payload['payhere_amount'] ?? ''}${payload['payhere_currency'] ?? ''}${payload['status_code'] ?? ''}${hashedSecret}`,
    )
    .digest('hex')
    .toUpperCase()

  return localSig === (payload['md5sig'] ?? '').toUpperCase()
}

export async function handlePayhereBillingWebhook(payload: Record<string, string>): Promise<void> {
  const invoiceId = payload['custom_1']
  if (!invoiceId) {
    return
  }

  const invoice = await prisma.subscriptionInvoice.findUnique({
    where:   { id: invoiceId },
    include: { plan: true },
  })
  if (!invoice || invoice.status === 'paid') {
    return
  }

  if (!verifyPayhereBillingWebhook(payload)) {
    console.warn(`[payhere billing webhook] signature mismatch for invoice ${invoiceId}`)
    return
  }

  if (payload['status_code'] !== '2') {
    return
  }

  await prisma.$transaction((tx) => applyInvoicePayment(tx, invoice))

  const owner = await findOwner(invoice.company_id)
  if (owner?.user.email) {
    await addEmailJob(owner.user.email, 'subscription_confirmed', {
      planName:        invoice.plan.name,
      billingCycle:    inferBillingCycle(invoice.billing_period_start, invoice.billing_period_end),
      nextRenewalDate: formatLocalDate(invoice.billing_period_end),
      dashboardUrl:    `${env.FRONTEND_URL}/settings/billing`,
    }, { companyId: invoice.company_id })
  }
}
