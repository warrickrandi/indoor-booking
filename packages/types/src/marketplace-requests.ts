import { z } from 'zod'

import { SPORT_TYPES } from './sub-venue-requests.js'

export const MarketplaceVenuesQuerySchema = z.object({
  sport_type: z.enum(SPORT_TYPES).optional(),
  city:       z.string().optional(),
  page:       z.coerce.number().int().positive().default(1),
  limit:      z.coerce.number().int().positive().max(50).default(12),
})

export const MarketplaceResolveDomainQuerySchema = z.object({
  host: z.string().min(1),
})

export type MarketplaceVenuesQuery = z.infer<typeof MarketplaceVenuesQuerySchema>
export type MarketplaceResolveDomainQuery = z.infer<typeof MarketplaceResolveDomainQuerySchema>
