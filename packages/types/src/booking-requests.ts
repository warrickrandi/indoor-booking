import { z } from 'zod'
import { DateStringSchema } from './slot-requests.js'

export const PaymentMethodSchema = z.enum(['online', 'bank_transfer', 'pay_at_venue'])

export const CustomerInfoSchema = z.object({
  full_name: z.string().min(1),
  email:     z.string().email(),
  phone:     z.string().min(1),
})

export const CreateBookingBodySchema = z.object({
  slot_id:        z.string().uuid(),
  lock_token:     z.string().min(1),
  payment_method: PaymentMethodSchema,
  customer_info:  CustomerInfoSchema.optional(),
  notes:          z.string().optional(),
})

export const CancelBookingBodySchema = z.object({
  reason: z.string().optional(),
})

export const ListBookingsQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  status:      z.string().optional(),
  from_date:   DateStringSchema.optional(),
  to_date:     DateStringSchema.optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(100).default(20),
})

export const UploadSlipBodySchema = z.object({
  slip_image_url: z.string().url(),
  bank_name:      z.string().min(1),
  transfer_ref:   z.string().min(1),
})

export const VerifySlipBodySchema = z
  .object({
    approved:          z.boolean(),
    rejection_reason:  z.string().optional(),
  })
  .refine((data) => data.approved || !!data.rejection_reason, {
    message: 'rejection_reason is required when approved is false',
    path:    ['rejection_reason'],
  })

export type PaymentMethod        = z.infer<typeof PaymentMethodSchema>
export type CustomerInfo         = z.infer<typeof CustomerInfoSchema>
export type CreateBookingBody    = z.infer<typeof CreateBookingBodySchema>
export type CancelBookingBody    = z.infer<typeof CancelBookingBodySchema>
export type ListBookingsQuery    = z.infer<typeof ListBookingsQuerySchema>
export type UploadSlipBody       = z.infer<typeof UploadSlipBodySchema>
export type VerifySlipBody       = z.infer<typeof VerifySlipBodySchema>
