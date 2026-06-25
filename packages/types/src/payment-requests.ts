import { z } from 'zod'
import { DateStringSchema } from './slot-requests.js'

export const InitiatePaymentBodySchema = z.object({
  booking_id: z.string().uuid(),
})

export const ListTransactionsQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  status:      z.string().optional(),
  from_date:   DateStringSchema.optional(),
  to_date:     DateStringSchema.optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(100).default(20),
})

export const GATEWAY_SLUGS = ['payhere', 'webxpay', 'directpay'] as const
export type GatewaySlug = (typeof GATEWAY_SLUGS)[number]

export const GatewaySlugParamSchema = z.object({
  slug: z.enum(GATEWAY_SLUGS),
})

export const GatewayConfigBodySchema = z.object({
  credentials: z
    .record(z.string().min(1))
    .refine((c) => Object.keys(c).length > 0, { message: 'At least one credential field is required' }),
})

export type InitiatePaymentBody    = z.infer<typeof InitiatePaymentBodySchema>
export type ListTransactionsQuery  = z.infer<typeof ListTransactionsQuerySchema>
export type GatewaySlugParam       = z.infer<typeof GatewaySlugParamSchema>
export type GatewayConfigBody      = z.infer<typeof GatewayConfigBodySchema>
