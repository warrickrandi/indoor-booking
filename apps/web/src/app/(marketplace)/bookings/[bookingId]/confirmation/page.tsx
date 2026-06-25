'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'

import { usePlayerAuthStore } from '@/store/player-auth.store'
import { useMyBooking } from '@/hooks/useMarketplaceBookings'
import { formatDate, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriceDisplay } from '@/components/marketplace/PriceDisplay'
import { BankDetails } from '@/components/marketplace/BankDetails'
import { SlipUploadForm } from '@/components/marketplace/SlipUploadForm'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  online: 'Online',
  bank_transfer: 'Bank Transfer',
  pay_at_venue: 'Pay at Venue',
}

export default function BookingConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const isAuthenticated = usePlayerAuthStore((state) => state.isAuthenticated)
  const queryClient = useQueryClient()

  const booking = useMyBooking(isAuthenticated ? bookingId : undefined)

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">Please sign in again</h1>
        <p className="mb-6 text-muted-foreground">
          Your session has expired. Sign in to view your booking confirmation.
        </p>
        <Button asChild>
          <Link href={`/player/login?redirect=/bookings/${bookingId}/confirmation`}>Sign in</Link>
        </Button>
      </div>
    )
  }

  if (booking.isLoading) {
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-emerald-500" />
        <h1 className="text-2xl font-semibold">Booking received</h1>
        <p className="text-muted-foreground">
          Reference <span className="font-mono font-medium">{data.booking_ref}</span>
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{data.time_slot.sub_venue_name}</CardTitle>
            <CardDescription>{data.time_slot.location_name}</CardDescription>
          </div>
          <StatusBadge status={data.status} />
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date &amp; time</span>
            <span>
              {formatDate(data.time_slot.start_time)}, {formatTime(data.time_slot.start_time)} -{' '}
              {formatTime(data.time_slot.end_time)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment method</span>
            <span>{PAYMENT_METHOD_LABELS[data.payment_method] ?? data.payment_method}</span>
          </div>
          {data.notes && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Notes</span>
              <span className="text-right">{data.notes}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Total</span>
            <PriceDisplay amount={data.total_amount} />
          </div>
        </CardContent>
      </Card>

      {data.payment_method === 'bank_transfer' && (
        <div className="mb-6 space-y-4">
          <BankDetails venue={{ name: data.time_slot.location_name }} />

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

      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/venues">Browse more venues</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/my-bookings">View my bookings</Link>
        </Button>
      </div>
    </div>
  )
}
