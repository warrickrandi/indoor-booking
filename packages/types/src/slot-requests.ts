import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const DateStringSchema = z
  .string()
  .regex(DATE_REGEX, 'Expected date in YYYY-MM-DD format')
  .refine((val) => !isNaN(Date.parse(`${val}T00:00:00Z`)), {
    message: 'Invalid calendar date',
  })

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`)
  const toMs   = Date.parse(`${to}T00:00:00Z`)
  return Math.round((toMs - fromMs) / 86_400_000)
}

export const GetSlotsQuerySchema = z.object({
  sub_venue_id: z.string().uuid(),
  date:         DateStringSchema,
})

export const SlotCalendarQuerySchema = z
  .object({
    location_id: z.string().uuid(),
    from_date:   DateStringSchema,
    to_date:     DateStringSchema,
  })
  .refine((data) => data.to_date >= data.from_date, {
    message: 'to_date must be on or after from_date',
    path:    ['to_date'],
  })
  .refine((data) => daysBetween(data.from_date, data.to_date) <= 60, {
    message: 'Date range cannot exceed 60 days',
    path:    ['to_date'],
  })

export const UpdateSlotBodySchema = z
  .object({
    status: z.enum(['available', 'inactive']).optional(),
    price:  z.number().positive().optional(),
  })
  .refine((data) => data.status !== undefined || data.price !== undefined, {
    message: 'At least one of status or price must be provided',
  })

export const UnlockSlotBodySchema = z.object({
  lock_token: z.string().min(1),
})

export const GenerateSlotsBodySchema = z
  .object({
    from_date: DateStringSchema,
    to_date:   DateStringSchema,
    overwrite: z.boolean().optional().default(false),
  })
  .refine((data) => data.to_date >= data.from_date, {
    message: 'to_date must be on or after from_date',
    path:    ['to_date'],
  })
  .refine((data) => daysBetween(data.from_date, data.to_date) <= 90, {
    message: 'Date range cannot exceed 90 days',
    path:    ['to_date'],
  })
  .refine(
    (data) => {
      const maxDate = new Date()
      maxDate.setUTCFullYear(maxDate.getUTCFullYear() + 1)
      return Date.parse(`${data.from_date}T00:00:00Z`) <= maxDate.getTime()
    },
    {
      message: 'from_date cannot be more than 1 year in the future',
      path:    ['from_date'],
    },
  )

export type GetSlotsQuery       = z.infer<typeof GetSlotsQuerySchema>
export type SlotCalendarQuery   = z.infer<typeof SlotCalendarQuerySchema>
export type UpdateSlotBody      = z.infer<typeof UpdateSlotBodySchema>
export type UnlockSlotBody      = z.infer<typeof UnlockSlotBodySchema>
export type GenerateSlotsBody   = z.infer<typeof GenerateSlotsBodySchema>
