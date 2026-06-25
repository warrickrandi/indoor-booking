import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/api'

export interface PricingRule {
  id: string
  rule_name: string
  rate_type: string
  price_per_slot: number
  slot_duration_mins: number
  peak_start: string | null
  peak_end: string | null
  applicable_days: number[]
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  created_at: string
}

export interface SubVenueSummary {
  id: string
  location_id: string
  name: string
  sport_type: string
  description: string | null
  capacity: number | null
  amenities: string[]
  status: string
  display_order: number
  pricing_rules_count: number
}

export interface SubVenueDetail extends Omit<SubVenueSummary, 'pricing_rules_count'> {
  pricing_rules: PricingRule[]
}

export function useSubVenues(locationId: string | undefined) {
  return useQuery({
    queryKey: ['sub-venues', locationId],
    queryFn: async () => (await get<SubVenueSummary[]>(`/locations/${locationId}/sub-venues`)).data,
    enabled: !!locationId,
  })
}

export function useSubVenue(locationId: string | undefined, subVenueId: string | undefined) {
  return useQuery({
    queryKey: ['sub-venues', locationId, subVenueId],
    queryFn: async () =>
      (await get<SubVenueDetail>(`/locations/${locationId}/sub-venues/${subVenueId}`)).data,
    enabled: !!locationId && !!subVenueId,
  })
}
