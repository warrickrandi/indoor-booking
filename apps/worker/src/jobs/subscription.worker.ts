import { Worker } from 'bullmq'
import { Prisma } from '@sports-booking/db'
import type { BillingCycle } from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { env } from '../lib/env.js'
import { addInterval, addDays, formatLocalDate } from '../lib/datetime.js'
import { sendEmail } from '../services/email.service.js'

const GRACE_PERIOD_DAYS = 7
const TRIAL_REMINDER_DAYS = 3

function planPrice(plan: { price_monthly: Prisma.Decimal; price_annual: Prisma.Decimal }, cycle: BillingCycle): number {
  return cycle === 'monthly' ? Number(plan.price_monthly) : Number(plan.price_annual)
}

function formatLKR(amount: number): string {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function findOwnerEmail(companyId: string): Promise<string | null> {
  const owner = await prisma.companyMember.findFirst({
    where:   { company_id: companyId, role: { name: 'owner' } },
    include: { user: { select: { email: true } } },
  })
  return owner?.user.email ?? null
}

export const subscriptionLifecycleWorker = new Worker(
  'subscription-lifecycle',
  async () => {
    const now = new Date()
    let trialReminders  = 0
    let renewalInvoices = 0
    let downgrades      = 0

    // ─── Trial-expiring reminders ──────────────────────────────────────────
    const trialingSoon = await prisma.company.findMany({
      where: {
        status:        'active',
        trial_ends_at: { gt: now, lte: new Date(now.getTime() + TRIAL_REMINDER_DAYS * 86_400_000) },
      },
      include: { plan: true },
    })

    for (const company of trialingSoon) {
      const alreadySent = await prisma.emailLog.findFirst({
        where: { company_id: company.id, template_key: 'trial_expiring' },
      })
      if (alreadySent) {
        continue
      }

      const ownerEmail = await findOwnerEmail(company.id)
      if (!ownerEmail) {
        continue
      }

      await sendEmail({
        to:       ownerEmail,
        template: 'trial_expiring',
        data: {
          planName:    company.plan.name,
          trialEndsAt: formatLocalDate(company.trial_ends_at!),
          upgradeUrl:  `${env.FRONTEND_URL}/settings/billing`,
        },
        companyId: company.id,
      })
      trialReminders++
    }

    // ─── Expired billing periods: renewal invoice / grace-period downgrade ──
    const expired = await prisma.company.findMany({
      where:   { status: 'active', subscription_expires_at: { lte: now } },
      include: { plan: true, scheduled_plan: true },
    })

    for (const company of expired) {
      const periodStart = company.subscription_expires_at!
      const elapsedDays = Math.floor((now.getTime() - periodStart.getTime()) / 86_400_000)

      if (elapsedDays >= GRACE_PERIOD_DAYS) {
        const basicPlan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { tier: 'basic' } })
        if (company.plan_id === basicPlan.id) {
          continue
        }

        await prisma.$transaction(async (tx) => {
          await tx.subscriptionInvoice.updateMany({
            where: { company_id: company.id, status: 'pending' },
            data:  { status: 'void' },
          })
          await tx.company.update({
            where: { id: company.id },
            data: {
              plan_id:                 basicPlan.id,
              billing_cycle:           'monthly',
              scheduled_plan_id:       null,
              subscription_expires_at: addInterval(now, 'monthly'),
            },
          })
        })

        const ownerEmail = await findOwnerEmail(company.id)
        if (ownerEmail) {
          await sendEmail({
            to:       ownerEmail,
            template: 'subscription_expired',
            data:     { upgradeUrl: `${env.FRONTEND_URL}/settings/billing` },
            companyId: company.id,
          })
        }
        downgrades++
        continue
      }

      const existingInvoice = await prisma.subscriptionInvoice.findFirst({
        where: {
          company_id:           company.id,
          status:               'pending',
          billing_period_start: { gte: periodStart },
        },
      })
      if (existingInvoice) {
        continue
      }

      const targetPlan = company.scheduled_plan ?? company.plan
      const cycle      = company.billing_cycle as BillingCycle
      const periodEnd  = addInterval(periodStart, cycle)
      const amount     = planPrice(targetPlan, cycle)

      await prisma.subscriptionInvoice.create({
        data: {
          company_id:           company.id,
          plan_id:              targetPlan.id,
          amount,
          currency:             'LKR',
          status:               'pending',
          billing_period_start: periodStart,
          billing_period_end:   periodEnd,
        },
      })

      if (company.scheduled_plan_id) {
        await prisma.company.update({
          where: { id: company.id },
          data:  { plan_id: targetPlan.id, scheduled_plan_id: null },
        })
      }

      const ownerEmail = await findOwnerEmail(company.id)
      if (ownerEmail) {
        await sendEmail({
          to:       ownerEmail,
          template: 'subscription_invoice',
          data: {
            companyName: company.name,
            planName:    targetPlan.name,
            amount:      formatLKR(amount),
            dueDate:     addDays(formatLocalDate(periodStart), GRACE_PERIOD_DAYS),
            invoiceUrl:  `${env.FRONTEND_URL}/settings/billing`,
          },
          companyId: company.id,
        })
      }
      renewalInvoices++
    }

    console.log(
      `[subscription-lifecycle] trial reminders: ${trialReminders}, renewal invoices: ${renewalInvoices}, downgrades: ${downgrades}`,
    )
  },
  { connection: redis },
)

subscriptionLifecycleWorker.on('error', (err: Error) => {
  console.error('[subscription-lifecycle worker] error:', err.message)
})
