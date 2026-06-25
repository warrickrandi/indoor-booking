import { useQuery } from '@tanstack/react-query'

import { mpGet } from '@/lib/marketplace-api'
import type { BookingSummary, BookingDetail, BookingFilters } from './useBookings'

export type { BookingSummary, BookingDetail, BookingFilters }

function buildQuery(filters: BookingFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useMyBookings(filters: BookingFilters = {}) {
  return useQuery({
    queryKey: ['my-bookings', filters],
    queryFn: () => mpGet<BookingSummary[]>(`/bookings/my${buildQuery(filters)}`, { requireAuth: true }),
  })
}

export function useMyBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['my-bookings', bookingId],
    queryFn: async () => (await mpGet<BookingDetail>(`/bookings/${bookingId}`, { requireAuth: true })).data,
    enabled: !!bookingId,
  })
}
