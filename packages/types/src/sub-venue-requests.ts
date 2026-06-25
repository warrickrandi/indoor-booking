import { z } from 'zod'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const TimeSchema = z.string().regex(TIME_REGEX, 'Expected time in HH:MM format')
const DateSchema = z.string().regex(DATE_REGEX, 'Expected date in YYYY-MM-DD format')

export const SPORT_TYPES = ['futsal', 'badminton', 'cricket', 'playhouse', 'other'] as const
export const RATE_TYPES = ['peak', 'off_peak', 'flat', 'weekend'] as const
export const SLOT_DURATIONS = [60, 90, 120] as const

export const CreateSubVenueBodySchema = z.object({
  name:          z.string().min(1),
  sport_type:    z.enum(SPORT_TYPES),
  description:   z.string().min(1).optional(),
  capacity:      z.number().int().positive().optional(),
  display_order: z.number().int().min(0).optional(),
  amenities:     z.array(z.string()).optional(),
})

export const UpdateSubVenueBodySchema = z.object({
  name:          z.string().min(1).optional(),
  sport_type:    z.enum(SPORT_TYPES).optional(),
  description:   z.string().min(1).optional(),
  capacity:      z.number().int().positive().optional(),
  status:        z.enum(['active', 'inactive']).optional(),
  display_order: z.number().int().min(0).optional(),
  amenities:     z.array(z.string()).optional(),
})

export const CreatePricingRuleBodySchema = z
  .object({
    rule_name:          z.string().min(1),
    rate_type:          z.enum(RATE_TYPES),
    price_per_slot:     z.number().positive(),
    slot_duration_mins: z.union([z.literal(60), z.literal(90), z.literal(120)]),
    peak_start:         TimeSchema.optional(),
    peak_end:           TimeSchema.optional(),
    applicable_days:    z.array(z.number().int().min(0).max(6)).min(1),
    valid_from:         DateSchema.optional(),
    valid_until:        DateSchema.optional(),
  })
  .refine(
    (data) =>
      (data.rate_type !== 'peak' && data.rate_type !== 'off_peak') ||
      (data.peak_start !== undefined && data.peak_end !== undefined),
    {
      message: 'peak_start and peak_end are required when rate_type is peak or off_peak',
      path:    ['peak_start'],
    },
  )

export const UpdatePricingRuleBodySchema = z.object({
  rule_name:          z.string().min(1).optional(),
  rate_type:          z.enum(RATE_TYPES).optional(),
  price_per_slot:     z.number().positive().optional(),
  slot_duration_mins: z.union([z.literal(60), z.literal(90), z.literal(120)]).optional(),
  peak_start:         TimeSchema.optional(),
  peak_end:           TimeSchema.optional(),
  applicable_days:    z.array(z.number().int().min(0).max(6)).min(1).optional(),
  valid_from:         DateSchema.optional(),
  valid_until:        DateSchema.optional(),
})

export type CreateSubVenueBody    = z.infer<typeof CreateSubVenueBodySchema>
export type UpdateSubVenueBody    = z.infer<typeof UpdateSubVenueBodySchema>
export type CreatePricingRuleBody = z.infer<typeof CreatePricingRuleBodySchema>
export type UpdatePricingRuleBody = z.infer<typeof UpdatePricingRuleBodySchema>
