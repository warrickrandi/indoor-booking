import { z } from 'zod'
import { DateStringSchema } from './slot-requests.js'

export const ListCompaniesQuerySchema = z.object({
  status: z.string().optional(),
  tier:   z.enum(['basic', 'pro', 'elite']).optional(),
  search: z.string().optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
})

export const UpdateCompanySubscriptionBodySchema = z
  .object({
    plan_id:        z.string().uuid().optional(),
    status:         z.enum(['active', 'suspended', 'cancelled']).optional(),
    trial_ends_at:  z.string().datetime().nullable().optional(),
  })
  .refine((data) => data.plan_id !== undefined || data.status !== undefined || data.trial_ends_at !== undefined, {
    message: 'At least one field must be provided',
  })

export const UpdateSubscriptionPlanBodySchema = z
  .object({
    price_monthly: z.number().positive().optional(),
    price_annual:  z.number().positive().optional(),
    feature_flags: z.record(z.boolean()).optional(),
    max_locations: z.number().int().positive().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  })

export const ListAuditLogsQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  user_id:    z.string().uuid().optional(),
  action:     z.string().optional(),
  from_date:  DateStringSchema.optional(),
  to_date:    DateStringSchema.optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
})

export const ListAdminBookingsQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  status:     z.string().optional(),
  from_date:  DateStringSchema.optional(),
  to_date:    DateStringSchema.optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(100).default(20),
})

export const UpdateGatewayDriverBodySchema = z
  .object({
    is_active:    z.boolean().optional(),
    display_name: z.string().min(1).optional(),
  })
  .refine((data) => data.is_active !== undefined || data.display_name !== undefined, {
    message: 'At least one field must be provided',
  })

export type ListCompaniesQuery              = z.infer<typeof ListCompaniesQuerySchema>
export type UpdateCompanySubscriptionBody   = z.infer<typeof UpdateCompanySubscriptionBodySchema>
export type UpdateSubscriptionPlanBody      = z.infer<typeof UpdateSubscriptionPlanBodySchema>
export type ListAuditLogsQuery              = z.infer<typeof ListAuditLogsQuerySchema>
export type ListAdminBookingsQuery          = z.infer<typeof ListAdminBookingsQuerySchema>
export type UpdateGatewayDriverBody         = z.infer<typeof UpdateGatewayDriverBodySchema>
