'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { usePlayerAuthStore } from '@/store/player-auth.store'
import { useMyBookings } from '@/hooks/useMarketplaceBookings'
import { mpPost } from '@/lib/marketplace-api'
import { showApiErrorToast } from '@/lib/api'
import { formatDate, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriceDisplay } from '@/components/marketplace/PriceDisplay'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'pending_verification', label: 'Pending verification' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CANCELLABLE_STATUSES = ['pending_payment', 'pending_verification', 'confirmed']
const PAGE_LIMIT = 10

export default function MyBookingsPage() {
  const router = useRouter()
  const isAuthenticated = usePlayerAuthStore((state) => state.isAuthenticated)
  const queryClient = useQueryClient()

  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/player/login?redirect=/my-bookings')
    }
  }, [isAuthenticated, router])

  const bookings = useMyBookings({
    status: status === 'all' ? undefined : status,
    page,
    limit: PAGE_LIMIT,
  })

  const cancelBooking = useMutation({
    mutationFn: (bookingId: string) => mpPost(`/bookings/${bookingId}/cancel`, {}, { requireAuth: true }),
    onSuccess: (_res, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      router.push(`/bookings/${bookingId}/cancelled`)
    },
    onError: showApiErrorToast,
  })

  const handleStatusChange = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  if (!isAuthenticated) {
    return <LoadingPanel className="py-24" />
  }

  const rows = bookings.data?.data ?? []
  const meta = bookings.data?.meta
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">My Bookings</h1>
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {bookings.isLoading ? (
        <LoadingPanel className="py-24" />
      ) : rows.length === 0 ? (
        <EmptyState title="No bookings found" description="You haven't made any bookings yet." />
      ) : (
        <div className="space-y-4">
          {rows.map((booking) => {
            const showUploadSlip = booking.status === 'pending_verification' && booking.payment_method === 'bank_transfer'
            const canCancel = CANCELLABLE_STATUSES.includes(booking.status)

            return (
              <Card key={booking.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{booking.time_slot.sub_venue_name}</CardTitle>
                    <CardDescription className="truncate">{booking.time_slot.location_name}</CardDescription>
                  </div>
                  <StatusBadge status={booking.status} className="shrink-0" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {formatDate(booking.time_slot.start_time)}, {formatTime(booking.time_slot.start_time)} -{' '}
                      {formatTime(booking.time_slot.end_time)}
                    </span>
                    <PriceDisplay amount={booking.total_amount} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ref <span className="font-mono">{booking.booking_ref}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/my-bookings/${booking.id}`}>View details</Link>
                    </Button>
                    {showUploadSlip && (
                      <Button asChild size="sm">
                        <Link href={`/bookings/${booking.id}/confirmation`}>Upload slip</Link>
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cancelBooking.isPending}
                        onClick={() => {
                          if (window.confirm('Cancel this booking?')) {
                            cancelBooking.mutate(booking.id)
                          }
                        }}
                      >
                        {cancelBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {meta && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
