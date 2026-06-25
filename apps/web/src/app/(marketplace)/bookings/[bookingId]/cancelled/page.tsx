'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { XCircle } from 'lucide-react'

import { usePlayerAuthStore } from '@/store/player-auth.store'
import { useMyBooking } from '@/hooks/useMarketplaceBookings'
import { formatDate, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { PriceDisplay } from '@/components/marketplace/PriceDisplay'

export default function BookingCancelledPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const isAuthenticated = usePlayerAuthStore((state) => state.isAuthenticated)

  const booking = useMyBooking(isAuthenticated ? bookingId : undefined)

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">Please sign in again</h1>
        <p className="mb-6 text-muted-foreground">Your session has expired. Sign in to view this booking.</p>
        <Button asChild>
          <Link href={`/player/login?redirect=/bookings/${bookingId}/cancelled`}>Sign in</Link>
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <XCircle className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Booking cancelled</h1>
        <p className="text-muted-foreground">
          Reference <span className="font-mono font-medium">{data.booking_ref}</span>
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{data.time_slot.sub_venue_name}</CardTitle>
          <CardDescription>{data.time_slot.location_name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date &amp; time</span>
            <span>
              {formatDate(data.time_slot.start_time)}, {formatTime(data.time_slot.start_time)} -{' '}
              {formatTime(data.time_slot.end_time)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Total</span>
            <PriceDisplay amount={data.total_amount} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/venues">Browse venues</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/my-bookings">View my bookings</Link>
        </Button>
      </div>
    </div>
  )
}
