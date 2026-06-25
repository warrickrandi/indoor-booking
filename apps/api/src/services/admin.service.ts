import { Prisma } from '@sports-booking/db'
import type {
  PlatformAdminActor,
  ListCompaniesQuery,
  UpdateCompanySubscriptionBody,
  UpdateSubscriptionPlanBody,
  ListAuditLogsQuery,
  ListAdminBookingsQuery,
  UpdateGatewayDriverBody,
  ListBillingInvoicesQuery,
  CreateManualInvoiceBody,
  MarkInvoicePaidBody,
} from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { env } from '../lib/env.js'
import { createAuditLog } from '../middleware/audit.js'
import { ConflictError, NotFoundError } from '../lib/errors.js'
import { addEmailJob } from '../jobs/email.job.js'
import { localDateTimeToUtc, addDays, formatLocalDate, getTodayLocalDateString } from '../lib/datetime.js'
import { serializeCompanyDetail, getMembers } from './company.service.js'
import { serializeBooking, serializeTimeSlotSummary } from './booking.service.js'
import { addInterval, applyInvoicePayment, formatLKR, serializeInvoice } from './billing.service.js'

const TIERS = ['basic', 'pro', 'elite'] as const

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getAdminStats() {
  const todayStr      = getTodayLocalDateString()
  const monthStartStr = `${todayStr.slice(0, 7)}-01`
  const monthStartUtc = localDateTimeToUtc(monthStartStr, 0)

  const [totalCompanies, totalBookingsAllTime, totalBookingsThisMonth, activeVenues, paidThisMonth, companies] =
    await Promise.all([
      prisma.company.count({ where: { status: 'active' } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { created_at: { gte: monthStartUtc } } }),
      prisma.location.count({ where: { status: 'active' } }),
      prisma.paymentTransaction.aggregate({
        where: { status: 'paid', paid_at: { gte: monthStartUtc } },
        _sum:  { amount: true },
      }),
      prisma.company.findMany({
        where:  { status: 'active' },
        select: { plan: { select: { tier: true } } },
      }),
    ])

  const companies_by_tier: Record<string, number> = { basic: 0, pro: 0, elite: 0 }
  for (const company of companies) {
    const tier = company.plan.tier
    if ((TIERS as readonly string[]).includes(tier)) {
      companies_by_tier[tier] = (companies_by_tier[tier] ?? 0) + 1
    }
  }

  const thirtyDaysAgoStr = addDays(todayStr, -29)
  const thirtyDaysAgoUtc = localDateTimeToUtc(thirtyDaysAgoStr, 0)
  const recentCompanies  = await prisma.company.findMany({
    where:  { created_at: { gte: thirtyDaysAgoUtc } },
    select: { created_at: true },
  })

  const signupCounts = new Map<string, number>()
  for (let date = thirtyDaysAgoStr; date <= todayStr; date = addDays(date, 1)) {
    signupCounts.set(date, 0)
  }
  for (const company of recentCompanies) {
    const date = formatLocalDate(company.created_at)
    signupCounts.set(date, (signupCounts.get(date) ?? 0) + 1)
  }
  const signups_by_day = Array.from(signupCounts.entries()).map(([date, count]) => ({ date, count }))

  return {
    total_companies:          totalCompanies,
    total_bookings:           { all_time: totalBookingsAllTime, this_month: totalBookingsThisMonth },
    total_revenue_this_month: Number(paidThisMonth._sum.amount ?? 0),
    companies_by_tier,
    new_signups_last_30_days: recentCompanies.length,
    signups_by_day,
    active_venues:            activeVenues,
  }
}

// ─── Companies ──────────────────────────────────────────────────────────────

export async function listCompanies(query: ListCompaniesQuery) {
  const where: Prisma.CompanyWhereInput = {}

  if (query.status) {
    where.status = query.status
  }
  if (query.tier) {
    where.plan = { tier: query.tier }
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
      {
        members: {
          some: {
            role: { name: 'owner' },
            user: { email: { contains: query.search, mode: 'insensitive' } },
          },
        },
      },
    ]
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: { plan: true, _count: { select: { locations: true, bookings: true } } },
      orderBy: { created_at: 'desc' },
      skip:    (query.page - 1) * query.limit,
      take:    query.limit,
    }),
    prisma.company.count({ where }),
  ])

  return {
    data: companies.map((company) => ({
      id:                  company.id,
      name:                company.name,
      slug:                company.slug,
      tier:                company.plan.tier,
      subscription_status: company.status,
      location_count:      company._count.locations,
      total_bookings:      company._count.bookings,
      created_at:          company.created_at.toISOString(),
    })),
    meta: { page: query.page, limit: query.limit, total },
  }
}

export async function getCompanyDetail(companyId: string) {
  const company = await prisma.company.findUnique({
    where:   { id: companyId },
    include: {
      plan:                  true,
      branding:              true,
      billing:               true,
      subscription_invoices: { orderBy: { created_at: 'desc' }, take: 20 },
      locations:             { include: { _count: { select: { sub_venues: true } } } },
    },
  })
  if (!company) {
    throw new NotFoundError('Company')
  }

  const [members, recentBookings, paymentSummary] = await Promise.all([
    getMembers(companyId),
    prisma.booking.findMany({
      where:   { company_id: companyId },
      include: {
        customer:  { select: { full_name: true, email: true } },
        time_slot: { include: { sub_venue: { include: { location: true } } } },
      },
      orderBy: { created_at: 'desc' },
      take:    10,
    }),
    prisma.paymentTransaction.groupBy({
      by:    ['status'],
      where: { company_id: companyId },
      _sum:  { amount: true },
      _count: true,
    }),
  ])

  return {
    ...serializeCompanyDetail(company),
    billing: company.billing
      ? {
          contact_name:        company.billing.contact_name,
          contact_email:       company.billing.contact_email,
          contact_phone:       company.billing.contact_phone,
          billing_address:     company.billing.billing_address,
          tax_id:              company.billing.tax_id,
          bank_name:           company.billing.bank_name,
          bank_account_name:   company.billing.bank_account_name,
          bank_account_number: company.billing.bank_account_number,
          bank_branch:         company.billing.bank_branch,
        }
      : null,
    locations: company.locations.map((location) => ({
      id:              location.id,
      name:            location.name,
      city:            location.city,
      status:          location.status,
      sub_venue_count: location._count.sub_venues,
    })),
    members,
    recent_bookings: recentBookings.map((booking) => ({
      ...serializeBooking(booking),
      time_slot: serializeTimeSlotSummary(booking.time_slot),
      customer:  { full_name: booking.customer.full_name, email: booking.customer.email },
    })),
    payment_summary: paymentSummary.map((row) => ({
      status: row.status,
      total:  Number(row._sum.amount ?? 0),
      count:  row._count,
    })),
    subscription_invoices: company.subscription_invoices.map((invoice) => ({
      id:                   invoice.id,
      amount:               Number(invoice.amount),
      currency:             invoice.currency,
      status:               invoice.status,
      billing_period_start: invoice.billing_period_start.toISOString(),
      billing_period_end:   invoice.billing_period_end.toISOString(),
      paid_at:              invoice.paid_at?.toISOString() ?? null,
      created_at:           invoice.created_at.toISOString(),
    })),
  }
}

export async function updateCompanySubscription(
  companyId: string,
  body: UpdateCompanySubscriptionBody,
  actor: PlatformAdminActor,
) {
  const before = await prisma.company.findUnique({ where: { id: companyId }, include: { plan: true } })
  if (!before) {
    throw new NotFoundError('Company')
  }

  if (body.plan_id) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: body.plan_id } })
    if (!plan) {
      throw new NotFoundError('Subscription plan')
    }
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      plan_id:       body.plan_id,
      status:        body.status,
      trial_ends_at:
        body.trial_ends_at === undefined ? undefined : body.trial_ends_at === null ? null : new Date(body.trial_ends_at),
    },
    include: { plan: true, branding: true },
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'platform_admin',
    company_id:  companyId,
    action:      'company.subscription_changed',
    entity_type: 'company',
    entity_id:   companyId,
    before: {
      plan:          before.plan.name,
      status:        before.status,
      trial_ends_at: before.trial_ends_at?.toISOString() ?? null,
    },
    after: {
      plan:          updated.plan.name,
      status:        updated.status,
      trial_ends_at: updated.trial_ends_at?.toISOString() ?? null,
    },
  })

  return serializeCompanyDetail(updated)
}

// ─── Subscription plans ─────────────────────────────────────────────────────

export async function listSubscriptionPlans() {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { price_monthly: 'asc' } })

  return plans.map((plan) => ({
    id:            plan.id,
    name:          plan.name,
    tier:          plan.tier,
    price_monthly: Number(plan.price_monthly),
    price_annual:  Number(plan.price_annual),
    max_locations: plan.max_locations,
    feature_flags: plan.feature_flags,
    is_active:     plan.is_active,
  }))
}

export async function updateSubscriptionPlan(
  planId: string,
  body: UpdateSubscriptionPlanBody,
  actor: PlatformAdminActor,
) {
  const before = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
  if (!before) {
    throw new NotFoundError('Subscription plan')
  }

  const updated = await prisma.subscriptionPlan.update({
    where: { id: planId },
    data: {
      price_monthly: body.price_monthly,
      price_annual:  body.price_annual,
      feature_flags: body.feature_flags as Prisma.InputJsonValue | undefined,
      max_locations: body.max_locations,
    },
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'platform_admin',
    action:      'subscription_plan.updated',
    entity_type: 'subscription_plan',
    entity_id:   planId,
    before: {
      price_monthly: Number(before.price_monthly),
      price_annual:  Number(before.price_annual),
      max_locations: before.max_locations,
      feature_flags: before.feature_flags,
    },
    after: {
      price_monthly: Number(updated.price_monthly),
      price_annual:  Number(updated.price_annual),
      max_locations: updated.max_locations,
      feature_flags: updated.feature_flags,
    },
  })

  return {
    id:            updated.id,
    name:          updated.name,
    tier:          updated.tier,
    price_monthly: Number(updated.price_monthly),
    price_annual:  Number(updated.price_annual),
    max_locations: updated.max_locations,
    feature_flags: updated.feature_flags,
    is_active:     updated.is_active,
  }
}

// ─── Audit logs ─────────────────────────────────────────────────────────────

export async function listAuditLogs(query: ListAuditLogsQuery, actor: PlatformAdminActor) {
  const where: Prisma.AuditLogWhereInput = {}

  if (query.company_id) {
    where.company_id = query.company_id
  }
  if (query.user_id) {
    where.actor_id = query.user_id
  }
  if (query.action) {
    where.action = query.action
  }
  if (query.from_date || query.to_date) {
    const createdAt: Prisma.DateTimeFilter = {}
    if (query.from_date) {
      createdAt.gte = localDateTimeToUtc(query.from_date, 0)
    }
    if (query.to_date) {
      createdAt.lt = localDateTimeToUtc(addDays(query.to_date, 1), 0)
    }
    where.created_at = createdAt
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
      skip:    (query.page - 1) * query.limit,
      take:    query.limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  const actorIds = Array.from(
    new Set(logs.map((log) => log.actor_id).filter((id): id is string => id !== null)),
  )
  const users = actorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, full_name: true, email: true } })
    : []
  const userById = new Map(users.map((user) => [user.id, user]))

  const isFinancialAction = (action: string) => action.includes('subscription') || action.includes('payment')

  return {
    data: logs.map((log) => {
      const redactChanges = actor.platform_role === 'platform_support' && isFinancialAction(log.action)

      return {
        id:          log.id,
        action:      log.action,
        entity_type: log.entity_type,
        entity_id:   log.entity_id,
        company:     log.company ? { id: log.company.id, name: log.company.name } : null,
        actor:       log.actor_id
          ? userById.get(log.actor_id) ?? { id: log.actor_id, full_name: null, email: null }
          : null,
        actor_type: log.actor_type,
        changes:    redactChanges ? undefined : log.changes,
        created_at: log.created_at.toISOString(),
      }
    }),
    meta: { page: query.page, limit: query.limit, total },
  }
}

// ─── Platform-wide bookings ─────────────────────────────────────────────────

export async function listAdminBookings(query: ListAdminBookingsQuery) {
  const where: Prisma.BookingWhereInput = {}
  const timeSlotWhere: Prisma.TimeSlotWhereInput = {}

  if (query.company_id) {
    where.company_id = query.company_id
  }
  if (query.status) {
    where.status = query.status
  }
  if (query.from_date || query.to_date) {
    const startTime: Prisma.DateTimeFilter = {}
    if (query.from_date) {
      startTime.gte = localDateTimeToUtc(query.from_date, 0)
    }
    if (query.to_date) {
      startTime.lt = localDateTimeToUtc(addDays(query.to_date, 1), 0)
    }
    timeSlotWhere.start_time = startTime
  }
  if (Object.keys(timeSlotWhere).length > 0) {
    where.time_slot = timeSlotWhere
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        company:   { select: { id: true, name: true } },
        customer:  { select: { full_name: true, email: true } },
        time_slot: { include: { sub_venue: { include: { location: true } } } },
      },
      orderBy: { created_at: 'desc' },
      skip:    (query.page - 1) * query.limit,
      take:    query.limit,
    }),
    prisma.booking.count({ where }),
  ])

  return {
    data: bookings.map((booking) => ({
      ...serializeBooking(booking),
      company:   { id: booking.company.id, name: booking.company.name },
      time_slot: serializeTimeSlotSummary(booking.time_slot),
      customer:  { full_name: booking.customer.full_name, email: booking.customer.email },
    })),
    meta: { page: query.page, limit: query.limit, total },
  }
}

// ─── Gateway drivers ─────────────────────────────────────────────────────────

export async function listGatewayDrivers() {
  const drivers = await prisma.gatewayDriver.findMany({ orderBy: { name: 'asc' } })

  return drivers.map((driver) => ({
    id:         driver.id,
    slug:       driver.slug,
    name:       driver.name,
    is_active:  driver.is_active,
    created_at: driver.created_at.toISOString(),
  }))
}

export async function updateGatewayDriver(
  driverId: string,
  body: UpdateGatewayDriverBody,
  actor: PlatformAdminActor,
) {
  const before = await prisma.gatewayDriver.findUnique({ where: { id: driverId } })
  if (!before) {
    throw new NotFoundError('Gateway driver')
  }

  const updated = await prisma.gatewayDriver.update({
    where: { id: driverId },
    data:  { is_active: body.is_active, name: body.display_name },
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'platform_admin',
    action:      'gateway_driver.updated',
    entity_type: 'gateway_driver',
    entity_id:   driverId,
    before:      { name: before.name, is_active: before.is_active },
    after:       { name: updated.name, is_active: updated.is_active },
  })

  return {
    id:         updated.id,
    slug:       updated.slug,
    name:       updated.name,
    is_active:  updated.is_active,
    created_at: updated.created_at.toISOString(),
  }
}

// ─── Billing invoices ────────────────────────────────────────────────────────

export async function listBillingInvoices(query: ListBillingInvoicesQuery) {
  const where: Prisma.SubscriptionInvoiceWhereInput = {}

  if (query.status) {
    where.status = query.status
  }
  if (query.company_id) {
    where.company_id = query.company_id
  }
  if (query.from_date || query.to_date) {
    const createdAt: Prisma.DateTimeFilter = {}
    if (query.from_date) {
      createdAt.gte = localDateTimeToUtc(query.from_date, 0)
    }
    if (query.to_date) {
      createdAt.lt = localDateTimeToUtc(addDays(query.to_date, 1), 0)
    }
    where.created_at = createdAt
  }

  const [invoices, total] = await Promise.all([
    prisma.subscriptionInvoice.findMany({
      where,
      include: { plan: true, company: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
      skip:    (query.page - 1) * query.limit,
      take:    query.limit,
    }),
    prisma.subscriptionInvoice.count({ where }),
  ])

  return {
    data: invoices.map((invoice) => ({
      ...serializeInvoice(invoice),
      company: { id: invoice.company.id, name: invoice.company.name },
    })),
    meta: { page: query.page, limit: query.limit, total },
  }
}

export async function createManualInvoice(body: CreateManualInvoiceBody, actor: PlatformAdminActor) {
  const company = await prisma.company.findUnique({ where: { id: body.company_id } })
  if (!company) {
    throw new NotFoundError('Company')
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: body.plan_id } })
  if (!plan) {
    throw new NotFoundError('Subscription plan')
  }

  const periodStart = new Date()
  const periodEnd = addInterval(periodStart, body.billing_cycle)

  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      company_id:           body.company_id,
      plan_id:              body.plan_id,
      amount:               body.amount,
      currency:             'LKR',
      status:               'pending',
      billing_period_start: periodStart,
      billing_period_end:   periodEnd,
    },
    include: { plan: true },
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'platform_admin',
    company_id:  body.company_id,
    action:      'billing.invoice_created',
    entity_type: 'subscription_invoice',
    entity_id:   invoice.id,
    after:       { plan: plan.name, amount: body.amount, billing_cycle: body.billing_cycle, due_date: body.due_date },
  })

  const owner = await prisma.companyMember.findFirst({
    where:   { company_id: body.company_id, role: { name: 'owner' } },
    include: { user: { select: { email: true } } },
  })

  if (owner?.user.email) {
    await addEmailJob(owner.user.email, 'subscription_invoice', {
      companyName: company.name,
      planName:    plan.name,
      amount:      formatLKR(body.amount),
      dueDate:     body.due_date,
      invoiceUrl:  `${env.FRONTEND_URL}/settings/billing`,
    }, { companyId: body.company_id })
  }

  return serializeInvoice(invoice)
}

export async function markInvoicePaid(invoiceId: string, body: MarkInvoicePaidBody, actor: PlatformAdminActor) {
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where:   { id: invoiceId },
    include: { plan: true, company: true },
  })
  if (!invoice) {
    throw new NotFoundError('Invoice')
  }
  if (invoice.status === 'paid') {
    throw new ConflictError('Invoice already marked as paid')
  }

  await prisma.$transaction((tx) => applyInvoicePayment(tx, invoice))

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'platform_admin',
    company_id:  invoice.company_id,
    action:      'billing.invoice_marked_paid',
    entity_type: 'subscription_invoice',
    entity_id:   invoice.id,
    after:       { status: 'paid', payment_ref: body.payment_ref ?? null },
  })

  const updatedCompany = await prisma.company.findUniqueOrThrow({ where: { id: invoice.company_id } })

  const owner = await prisma.companyMember.findFirst({
    where:   { company_id: invoice.company_id, role: { name: 'owner' } },
    include: { user: { select: { email: true } } },
  })

  if (owner?.user.email) {
    await addEmailJob(owner.user.email, 'subscription_confirmed', {
      planName:        invoice.plan.name,
      billingCycle:    updatedCompany.billing_cycle,
      nextRenewalDate: formatLocalDate(invoice.billing_period_end),
      dashboardUrl:    `${env.FRONTEND_URL}/settings/billing`,
    }, { companyId: invoice.company_id })
  }

  return serializeInvoice({ ...invoice, status: 'paid', paid_at: new Date() })
}
