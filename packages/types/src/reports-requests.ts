import { z } from 'zod'
import { DateStringSchema } from './slot-requests.js'

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`)
  const toMs   = Date.parse(`${to}T00:00:00Z`)
  return Math.round((toMs - fromMs) / 86_400_000)
}

const dateRange = <T extends { from_date: string; to_date: string }>(schema: z.ZodType<T>) =>
  schema
    .refine((data) => data.to_date >= data.from_date, {
      message: 'to_date must be on or after from_date',
      path:    ['to_date'],
    })
    .refine((data) => daysBetween(data.from_date, data.to_date) <= 365, {
      message: 'Date range cannot exceed 365 days',
      path:    ['to_date'],
    })

export const DailySummaryQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  date:        DateStringSchema,
})

export const RevenueReportQuerySchema = dateRange(
  z.object({
    from_date:   DateStringSchema,
    to_date:     DateStringSchema,
    location_id: z.string().uuid().optional(),
    group_by:    z.enum(['day', 'week', 'month']).default('day'),
  }),
)

export const OccupancyReportQuerySchema = dateRange(
  z.object({
    from_date:   DateStringSchema,
    to_date:     DateStringSchema,
    location_id: z.string().uuid().optional(),
  }),
)

export const ExportReportQuerySchema = dateRange(
  z.object({
    type:        z.enum(['bookings', 'transactions']),
    from_date:   DateStringSchema,
    to_date:     DateStringSchema,
    format:      z.literal('csv'),
    location_id: z.string().uuid().optional(),
  }),
)

export type DailySummaryQuery   = z.infer<typeof DailySummaryQuerySchema>
export type RevenueReportQuery  = z.infer<typeof RevenueReportQuerySchema>
export type OccupancyReportQuery = z.infer<typeof OccupancyReportQuerySchema>
export type ExportReportQuery   = z.infer<typeof ExportReportQuerySchema>
