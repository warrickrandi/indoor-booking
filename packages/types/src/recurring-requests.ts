import { z } from 'zod'
import { DateStringSchema } from './slot-requests.js'
import { CustomerInfoSchema } from './booking-requests.js'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

/** Longest series a single permanent-slot request can cover. */
export const MAX_RECURRING_RANGE_DAYS = 366

export const RecurringRequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled'])

/** Minutes since midnight; an end time of 00:00 means midnight at the end of the day. */
export function recurringTimeToMinutes(time: string, isEnd = false): number {
  const [hours, minutes] = time.split(':').map(Number)
  const total = (hours ?? 0) * 60 + (minutes ?? 0)
  return isEnd && total === 0 ? 1440 : total
}

export const CreateRecurringRequestBodySchema = z
  .object({
    sub_venue_id:  z.string().uuid(),
    day_of_week:   z.number().int().min(0).max(6),
    start_time:    z.string().regex(TIME_REGEX, 'Expected time in HH:MM format'),
    end_time:      z.string().regex(TIME_REGEX, 'Expected time in HH:MM format'),
    start_date:    DateStringSchema,
    end_date:      DateStringSchema,
    notes:         z.string().trim().max(1000).optional(),
    /** Required when staff enter a request on behalf of a customer; ignored for players. */
    customer_info: CustomerInfoSchema.optional(),
  })
  .refine((data) => recurringTimeToMinutes(data.end_time, true) > recurringTimeToMinutes(data.start_time), {
    message: 'End time must be after start time',
    path:    ['end_time'],
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: 'End date must be on or after start date',
    path:    ['end_date'],
  })
  .refine(
    (data) =>
      (Date.parse(`${data.end_date}T00:00:00Z`) - Date.parse(`${data.start_date}T00:00:00Z`)) / 86_400_000 <=
      MAX_RECURRING_RANGE_DAYS,
    { message: `A permanent slot can cover at most ${MAX_RECURRING_RANGE_DAYS} days`, path: ['end_date'] },
  )

export const ListRecurringRequestsQuerySchema = z.object({
  status:      RecurringRequestStatusSchema.optional(),
  location_id: z.string().uuid().optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(100).default(20),
})

export const ApproveRecurringRequestBodySchema = z.object({
  review_note: z.string().trim().max(1000).optional(),
})

export const RejectRecurringRequestBodySchema = z.object({
  review_note: z.string().trim().min(1, 'Please give the customer a reason').max(1000),
})

export const CancelRecurringRequestBodySchema = z.object({
  reason: z.string().trim().max(1000).optional(),
})

export type RecurringRequestStatus       = z.infer<typeof RecurringRequestStatusSchema>
export type CreateRecurringRequestBody   = z.infer<typeof CreateRecurringRequestBodySchema>
export type ListRecurringRequestsQuery   = z.infer<typeof ListRecurringRequestsQuerySchema>
export type ApproveRecurringRequestBody  = z.infer<typeof ApproveRecurringRequestBodySchema>
export type RejectRecurringRequestBody   = z.infer<typeof RejectRecurringRequestBodySchema>
export type CancelRecurringRequestBody   = z.infer<typeof CancelRecurringRequestBodySchema>
