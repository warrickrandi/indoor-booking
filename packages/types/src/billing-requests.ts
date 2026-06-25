import { z } from 'zod'
import { DateStringSchema } from './slot-requests.js'

export const BillingCycleSchema = z.enum(['monthly', 'annual'])
export type BillingCycle = z.infer<typeof BillingCycleSchema>

export const UpgradeSubscriptionBodySchema = z.object({
  plan_id:       z.string().uuid(),
  billing_cycle: BillingCycleSchema,
})
export type UpgradeSubscriptionBody = z.infer<typeof UpgradeSubscriptionBodySchema>

export const ListBillingInvoicesQuerySchema = z.object({
  status:     z.string().optional(),
  company_id: z.string().uuid().optional(),
  from_date:  DateStringSchema.optional(),
  to_date:    DateStringSchema.optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
})
export type ListBillingInvoicesQuery = z.infer<typeof ListBillingInvoicesQuerySchema>

export const CreateManualInvoiceBodySchema = z.object({
  company_id:    z.string().uuid(),
  plan_id:       z.string().uuid(),
  billing_cycle: BillingCycleSchema,
  amount:        z.number().positive(),
  due_date:      DateStringSchema,
})
export type CreateManualInvoiceBody = z.infer<typeof CreateManualInvoiceBodySchema>

export const MarkInvoicePaidBodySchema = z.object({
  payment_ref: z.string().min(1).optional(),
})
export type MarkInvoicePaidBody = z.infer<typeof MarkInvoicePaidBodySchema>
