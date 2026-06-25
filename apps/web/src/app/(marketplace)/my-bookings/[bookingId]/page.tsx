'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Loader2 } from 'lucide-react'

import { usePlayerAuthStore } from '@/store/player-auth.store'
import { useMyBooking } from '@/hooks/useMarketplaceBookings'
import { mpPost } from '@/lib/marketplace-api'
import { showApiErrorToast } from '@/lib/api'
import { formatDate, formatDateTime, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { BookingTimeline } from '@/components/shared/BookingTimeline'
import { PriceDisplay } from '@/components/marketplace/PriceDisplay'
import { BankDetails } from '@/components/marketplace/BankDetails'
import { SlipUploadForm } from '@/components/marketplace/SlipUploadForm'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  online: 'Online',
  bank_transfer: 'Bank Transfer',
  pay_at_venue: 'Pay at Venue',
}

const CANCELLABLE_STATUSES = ['pending_payment', 'pending_verification', 'confirmed']

export default function MyBookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const router = useRouter()
  const isAuthenticated = usePlayerAuthStore((state) => state.isAuthenticated)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(`/player/login?redirect=/my-bookings/${bookingId}`)
    }
  }, [isAuthenticated, router, bookingId])

  const booking = useMyBooking(isAuthenticated ? bookingId : undefined)

  const cancelBooking = useMutation({
    mutationFn: () => mpPost(`/bookings/${bookingId}/cancel`, {}, { requireAuth: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      router.push(`/bookings/${bookingId}/cancelled`)
    },
    onError: showApiErrorToast,
  })

  if (!isAuthenticated || booking.isLoading) {
    return <LoadingPanel className="py-24" />
  }

  if (!booking.data) {
    return <EmptyState title="Booking not found" description="This booking may have been removed." />
  }

  const data = booking.data
  const transaction = data.payment_transactions[0]
  const pendingVerification = transaction?.bank_verifications.find((v) => v.status === 'pending')
  const showUploadSlip =
    data.status === 'pending_verification' && data.payment_method === 'bank_transfer' && !pendingVerification
  const canCancel = CANCELLABLE_STATUSES.includes(data.status)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/my-bookings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to my bookings
      </Link>

      <div className="mb-6 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{data.booking_ref}</h1>
          <p className="truncate text-muted-foreground">
            {data.time_slot.sub_venue_name} &middot; {data.time_slot.location_name}
          </p>
        </div>
        <StatusBadge status={data.status} className="shrink-0" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Booking details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span className="text-muted-foreground">Date &amp; time</span>
            <span className="sm:text-right">
              {formatDate(data.time_slot.start_time)}, {formatTime(data.time_slot.start_time)} -{' '}
              {formatTime(data.time_slot.end_time)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span className="text-muted-foreground">Sport</span>
            <span className="capitalize sm:text-right">{data.time_slot.sport_type}</span>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span className="text-muted-foreground">Payment method</span>
            <span className="sm:text-right">{PAYMENT_METHOD_LABELS[data.payment_method] ?? data.payment_method}</span>
          </div>
          {data.notes && (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <span className="text-muted-foreground">Notes</span>
              <span className="sm:text-right">{data.notes}</span>
            </div>
          )}
          <div className="flex flex-col gap-0.5 border-t pt-2 font-medium sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span>Total</span>
            <PriceDisplay amount={data.total_amount} className="sm:text-right" />
          </div>
        </CardContent>
      </Card>

      {data.payment_method === 'bank_transfer' && (
        <div className="mb-6 space-y-4">
          {(pendingVerification || showUploadSlip) && <BankDetails venue={{ name: data.time_slot.location_name }} />}

          {pendingVerification && (
            <div className="rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">
              Your payment slip has been submitted and is awaiting verification by the venue.
            </div>
          )}

          {showUploadSlip && (
            <SlipUploadForm
              bookingId={bookingId}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ['my-bookings', bookingId] })}
            />
          )}
        </div>
      )}

      {data.payment_transactions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.payment_transactions.map((tx) => (
              <div key={tx.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      <PriceDisplay amount={tx.amount} />
                    </p>
                    <p className="text-xs text-muted-foreground">{tx.gateway_slug}</p>
                  </div>
                  <StatusBadge status={tx.status} />
                </div>
                {tx.paid_at && <p className="mt-1 text-xs text-muted-foreground">Paid {formatDateTime(tx.paid_at)}</p>}
                {tx.bank_verifications.map((v) => (
                  <div key={v.id} className="mt-2 rounded-md bg-muted p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium">
                        {v.bank_name} &middot; {v.transfer_ref}
                      </p>
                      <StatusBadge status={v.status} className="shrink-0" />
                    </div>
                    {v.rejection_reason && <p className="mt-1 text-muted-foreground">Reason: {v.rejection_reason}</p>}
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingTimeline entries={data.status_log} />
        </CardContent>
      </Card>

      {canCancel && (
        <Button
          variant="outline"
          disabled={cancelBooking.isPending}
          onClick={() => {
            if (window.confirm('Cancel this booking?')) {
              cancelBooking.mutate()
            }
          }}
        >
          {cancelBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Cancel booking
        </Button>
      )}
    </div>
  )
}
