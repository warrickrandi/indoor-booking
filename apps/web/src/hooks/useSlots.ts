import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/api'
import type { SlotSummary } from '@/components/shared/SlotGrid'

export interface SlotsResponse {
  available: SlotSummary[]
  locked: SlotSummary[]
  booked: SlotSummary[]
}

export function useSlots(subVenueId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['slots', subVenueId, date],
    queryFn: async () =>
      (await get<SlotsResponse>(`/slots?sub_venue_id=${subVenueId}&date=${date}`)).data,
    enabled: !!subVenueId && !!date,
    refetchInterval: 30_000,
  })
}

export interface SlotCalendarEntry {
  date: string
  sub_venue_id: string
  available: number
  booked: number
  locked: number
}

export function useSlotCalendar(locationId: string | undefined, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['slot-calendar', locationId, fromDate, toDate],
    queryFn: async () =>
      (
        await get<SlotCalendarEntry[]>(
          `/slots/calendar?location_id=${locationId}&from_date=${fromDate}&to_date=${toDate}`,
        )
      ).data,
    enabled: !!locationId,
  })
}
