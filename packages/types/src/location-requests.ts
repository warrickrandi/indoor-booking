import { z } from 'zod'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const TimeSchema = z.string().regex(TIME_REGEX, 'Expected time in HH:MM format')
const DateSchema = z.string().regex(DATE_REGEX, 'Expected date in YYYY-MM-DD format')

export const CreateLocationBodySchema = z.object({
  name:          z.string().min(1),
  address:       z.string().min(1),
  city:          z.string().min(1),
  timezone:      z.string().min(1),
  phone:         z.string().min(1).optional(),
  display_order: z.number().int().min(0).optional(),
})

export const UpdateLocationBodySchema = z.object({
  name:          z.string().min(1).optional(),
  address:       z.string().min(1).optional(),
  city:          z.string().min(1).optional(),
  timezone:      z.string().min(1).optional(),
  phone:         z.string().min(1).optional(),
  status:        z.enum(['active', 'inactive']).optional(),
  display_order: z.number().int().min(0).optional(),
})

const OperatingHourSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  open_time:   TimeSchema,
  close_time:  TimeSchema,
  is_closed:   z.boolean(),
})

export const UpdateHoursBodySchema = z.object({
  hours: z
    .array(OperatingHourSchema)
    .length(7, 'Must provide exactly 7 entries, one per day of week')
    .refine(
      (hours) => new Set(hours.map((h) => h.day_of_week)).size === 7,
      { message: 'day_of_week must be unique across the 7 entries (0-6)' },
    ),
})

export const CreateHolidayBodySchema = z
  .object({
    holiday_date: DateSchema,
    label:        z.string().min(1),
    full_day:     z.boolean(),
    custom_open:  TimeSchema.optional(),
    custom_close: TimeSchema.optional(),
  })
  .refine((data) => data.full_day || (data.custom_open && data.custom_close), {
    message: 'custom_open and custom_close are required when full_day is false',
    path:    ['custom_open'],
  })

export type CreateLocationBody = z.infer<typeof CreateLocationBodySchema>
export type UpdateLocationBody = z.infer<typeof UpdateLocationBodySchema>
export type UpdateHoursBody    = z.infer<typeof UpdateHoursBodySchema>
export type CreateHolidayBody  = z.infer<typeof CreateHolidayBodySchema>
