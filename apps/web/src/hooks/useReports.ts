import { useMutation, useQuery } from '@tanstack/react-query'

import { ApiError, get } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export interface BookingsByStatus {
  status: string
  count: number
}

export interface RevenueByPaymentMethod {
  payment_method: string
  total: number
}

export interface SubVenueOccupancy {
  sub_venue_id: string
  sub_venue_name: string
  total_slots: number
  booked_slots: number
  occupancy_rate: number
}

export interface DailySummary {
  date: string
  bookings_by_status: BookingsByStatus[]
  revenue_by_payment_method: RevenueByPaymentMethod[]
  occupancy: SubVenueOccupancy[]
  pending_verifications: number
}

export interface RevenueByPeriod {
  period: string
  total: number
  online: number
  bank_transfer: number
  pay_at_venue: number
}

export interface RevenueByLocation {
  location_id: string
  location_name: string
  total: number
}

export interface RevenueBySubVenue {
  sub_venue_id: string
  sub_venue_name: string
  total: number
}

export interface RevenueReport {
  by_period: RevenueByPeriod[]
  by_location: RevenueByLocation[]
  by_sub_venue: RevenueBySubVenue[]
}

export interface OccupancyCell {
  date: string
  sub_venue_id: string
  sub_venue_name: string
  total_slots: number
  booked_slots: number
  occupancy_rate: number
}

export interface PeakHour {
  hour: string
  booking_count: number
}

export interface OccupancyReport {
  data: OccupancyCell[]
  peak_hours: PeakHour[]
}

export interface DailySummaryFilters {
  location_id?: string
  date: string
}

export interface RevenueFilters {
  from_date: string
  to_date: string
  location_id?: string
  group_by?: 'day' | 'week' | 'month'
}

export interface OccupancyFilters {
  from_date: string
  to_date: string
  location_id?: string
}

export interface ExportReportParams {
  type: 'bookings' | 'transactions'
  from_date: string
  to_date: string
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useDailySummary(filters: DailySummaryFilters) {
  return useQuery({
    queryKey: ['reports', 'daily-summary', filters],
    queryFn: async () => (await get<DailySummary>(`/reports/daily-summary${buildQuery(filters)}`)).data,
  })
}

export function useRevenue(filters: RevenueFilters) {
  return useQuery({
    queryKey: ['reports', 'revenue', filters],
    queryFn: async () => (await get<RevenueReport>(`/reports/revenue${buildQuery(filters)}`)).data,
  })
}

export function useOccupancy(filters: OccupancyFilters) {
  return useQuery({
    queryKey: ['reports', 'occupancy', filters],
    queryFn: async () => (await get<OccupancyReport>(`/reports/occupancy${buildQuery(filters)}`)).data,
  })
}

export function useExportReport() {
  return useMutation({
    mutationFn: async ({ type, from_date, to_date }: ExportReportParams) => {
      const token = getAccessToken()
      const qs = buildQuery({ type, from_date, to_date, format: 'csv' })
      const res = await fetch(`${API_URL}/reports/export${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null
        throw new ApiError(body?.error ?? 'Export failed', body?.code ?? 'UNKNOWN_ERROR', res.status)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${type}-report.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    },
  })
}
