import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/api'
import type { BookingStatusLogEntry } from '@/components/shared/BookingTimeline'

export interface TimeSlotSummary {
  id: string
  start_time: string
  end_time: string
  sub_venue_id: string
  sub_venue_name: string
  sport_type: string
  location_id: string
  location_name: string
}

export interface BookingSummary {
  id: string
  booking_ref: string
  status: string
  payment_method: string
  total_amount: number
  currency: string
  customer_id: string
  time_slot_id: string
  company_id: string
  notes: string | null
  booked_by_type: string
  booked_by_id: string | null
  created_at: string
  updated_at: string
  time_slot: TimeSlotSummary
  customer: { full_name: string; email: string }
}

export interface BankVerification {
  id: string
  slip_image_url: string
  bank_name: string
  transfer_ref: string
  status: string
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface PaymentTransaction {
  id: string
  booking_id: string
  gateway_slug: string
  amount: number
  currency: string
  status: string
  gateway_order_id: string | null
  paid_at: string | null
  created_at: string
  bank_verifications: BankVerification[]
}

export interface BookingDetail extends Omit<BookingSummary, 'customer'> {
  customer: { id: string; full_name: string; email: string; phone: string }
  payment_transactions: PaymentTransaction[]
  status_log: BookingStatusLogEntry[]
}

export interface BookingFilters {
  location_id?: string
  status?: string
  from_date?: string
  to_date?: string
  page?: number
  limit?: number
}

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

export function useBookings(filters: BookingFilters = {}) {
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => get<BookingSummary[]>(`/bookings${buildQuery(filters)}`),
  })
}

export function useBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: async () => (await get<BookingDetail>(`/bookings/${bookingId}`)).data,
    enabled: !!bookingId,
  })
}
