import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/api'

export interface OperatingHour {
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

export interface LocationHoliday {
  id: string
  holiday_date: string
  label: string
  full_day: boolean
  custom_open: string | null
  custom_close: string | null
}

export interface LocationSummary {
  id: string
  name: string
  address: string
  city: string
  phone: string | null
  timezone: string
  status: string
  display_order: number
  operating_hours: OperatingHour[]
  sub_venues_count: number
}

export interface LocationDetail extends LocationSummary {
  holidays: LocationHoliday[]
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await get<LocationSummary[]>('/locations')).data,
  })
}

export function useLocation(locationId: string | undefined) {
  return useQuery({
    queryKey: ['locations', locationId],
    queryFn: async () => (await get<LocationDetail>(`/locations/${locationId}`)).data,
    enabled: !!locationId,
  })
}
