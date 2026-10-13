import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateRecurringRequestBody,
  RecurringRequestStatus,
} from '@sports-booking/types'

import { get, post } from '@/lib/api'
import { mpGet, mpPost } from '@/lib/marketplace-api'
import type { BookingSummary } from './useBookings'

export const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface RecurringRequest {
  id: string
  company_id: string
  location_id: string
  location_name: string
  sub_venue_id: string
  sub_venue_name: string
  sport_type: string
  day_of_week: number
  start_time: string
  end_time: string
  start_date: string
  end_date: string
  notes: string | null
  source: 'player' | 'staff'
  status: RecurringRequestStatus
  review_note: string | null
  reviewed_at: string | null
  booking_count: number
  customer: { id: string; full_name: string; email: string | null; phone: string | null }
  created_at: string
  updated_at: string
}

export interface RecurringOccurrence {
  date: string
  status: 'available' | 'conflict' | 'no_matching_slots' | 'not_generated'
  reason?: string
  slot_ids: string[]
  amount: number
}

export interface RecurringRequestDetail extends RecurringRequest {
  occurrences: RecurringOccurrence[] | null
  bookings: Omit<BookingSummary, 'customer'>[]
}

export interface RecurringRequestFilters {
  status?: RecurringRequestStatus
  location_id?: string
  page?: number
  limit?: number
}

function buildQuery(filters: RecurringRequestFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** "Every Monday, 18:00–20:00" */
export function describeRecurringSlot(request: Pick<RecurringRequest, 'day_of_week' | 'start_time' | 'end_time'>) {
  return `Every ${WEEKDAY_LABELS[request.day_of_week]}, ${request.start_time}–${request.end_time}`
}

// ─── Backoffice ─────────────────────────────────────────────────────────────

export function useRecurringRequests(filters: RecurringRequestFilters = {}) {
  return useQuery({
    queryKey: ['recurring-requests', filters],
    queryFn: () => get<RecurringRequest[]>(`/recurring-requests${buildQuery(filters)}`),
  })
}

export function useRecurringRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: ['recurring-requests', 'detail', requestId],
    queryFn: async () => (await get<RecurringRequestDetail>(`/recurring-requests/${requestId}`)).data,
    enabled: !!requestId,
  })
}

export function useCreateRecurringRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRecurringRequestBody) => post<RecurringRequest>('/recurring-requests', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-requests'] }),
  })
}

export interface ApproveRecurringResult {
  request: RecurringRequestDetail
  bookings_created: number
  skipped_dates: { date: string; reason: string }[]
}

function useReviewMutation<TBody, TResult>(requestId: string, action: 'approve' | 'reject' | 'cancel') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TBody) => post<TResult>(`/recurring-requests/${requestId}/${action}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-requests'] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
    },
  })
}

export function useApproveRecurringRequest(requestId: string) {
  return useReviewMutation<{ review_note?: string }, ApproveRecurringResult>(requestId, 'approve')
}

export function useRejectRecurringRequest(requestId: string) {
  return useReviewMutation<{ review_note: string }, RecurringRequest>(requestId, 'reject')
}

export function useCancelRecurringRequest(requestId: string) {
  return useReviewMutation<{ reason?: string }, { request: RecurringRequestDetail; bookings_cancelled: number }>(
    requestId,
    'cancel',
  )
}

// ─── Marketplace (player) ───────────────────────────────────────────────────

export function useMyRecurringRequests() {
  return useQuery({
    queryKey: ['my-recurring-requests'],
    queryFn: () => mpGet<RecurringRequest[]>('/recurring-requests/my?limit=50', { requireAuth: true }),
  })
}

export function useSubmitRecurringRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<CreateRecurringRequestBody, 'customer_info'>) =>
      mpPost<RecurringRequest>('/recurring-requests', body, { requireAuth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-recurring-requests'] }),
  })
}

export function useWithdrawRecurringRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      mpPost(`/recurring-requests/${requestId}/cancel`, {}, { requireAuth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-recurring-requests'] }),
  })
}
