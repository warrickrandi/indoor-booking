'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarPlus, ClipboardCheck, MapPin, ArrowRight } from 'lucide-react'

import { useAuthStore } from '@/store/auth.store'
import { useLocations } from '@/hooks/useLocations'
import { useBookings } from '@/hooks/useBookings'
import { addDaysToDateString, formatCurrency, formatTime, todayDateString } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'

export default function OverviewPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const actor = useAuthStore((state) => state.actor)

  const today = todayDateString()
  const weekFromNow = addDaysToDateString(today, 7)

  const locations = useLocations()
  const todayBookings = useBookings({ from_date: today, to_date: today, limit: 50 })
  const pendingSlips = useBookings({ status: 'pending_verification', limit: 5 })
  const upcoming = useBookings({ from_date: today, to_date: weekFromNow, limit: 10 })

  const canManageLocations = actor?.permissions.includes('locations.write') ?? false
  const canViewBookings = actor?.permissions.includes('bookings.read') ?? false

  const showOnboarding = locations.data !== undefined && locations.data.length === 0

  return (
    <div>
      <PageHeader title="Overview" description={`Welcome back, ${user?.full_name ?? 'there'}`} />

      {showOnboarding && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">Set up your first location</h3>
              <p className="text-sm text-muted-foreground">
                Add a location to start configuring sub-venues, pricing, and bookable slots.
              </p>
            </div>
            {canManageLocations && (
              <Button asChild>
                <Link href="/locations/new">Add Location</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {canViewBookings && (
          <Button asChild>
            <Link href="/bookings/new">
              <CalendarPlus className="h-4 w-4" />
              New Booking
            </Link>
          </Button>
        )}
        {canManageLocations && (
          <Button variant="outline" asChild>
            <Link href="/locations/new">
              <MapPin className="h-4 w-4" />
              Add Location
            </Link>
          </Button>
        )}
        {canViewBookings && (
          <Button variant="outline" asChild>
            <Link href="/bookings?status=pending_verification">
              <ClipboardCheck className="h-4 w-4" />
              View Pending Slips
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today&apos;s Bookings</CardTitle>
            <CardDescription>Bookings scheduled for today across your locations</CardDescription>
          </CardHeader>
          <CardContent>
            {todayBookings.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !todayBookings.data || todayBookings.data.data.length === 0 ? (
              <EmptyState title="No bookings today" description="Bookings made for today will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayBookings.data.data.map((booking) => (
                    <TableRow
                      key={booking.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/bookings/${booking.id}`)}
                    >
                      <TableCell className="font-medium">{booking.booking_ref}</TableCell>
                      <TableCell>{booking.customer.full_name}</TableCell>
                      <TableCell>
                        {booking.time_slot.sub_venue_name}
                        <span className="block text-xs text-muted-foreground">
                          {booking.time_slot.location_name}
                        </span>
                      </TableCell>
                      <TableCell>{formatTime(booking.time_slot.start_time)}</TableCell>
                      <TableCell>
                        <StatusBadge status={booking.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(booking.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Slip Verifications</CardTitle>
            <CardDescription>Bank transfer slips awaiting review</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSlips.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !pendingSlips.data || pendingSlips.data.data.length === 0 ? (
              <EmptyState title="Nothing pending" description="Slips awaiting review will show up here." />
            ) : (
              <ul className="space-y-2">
                {pendingSlips.data.data.map((booking) => (
                  <li key={booking.id}>
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{booking.booking_ref}</p>
                        <p className="text-muted-foreground">
                          {booking.customer.full_name} &middot; {booking.time_slot.sub_venue_name}
                        </p>
                      </div>
                      <StatusBadge status={booking.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {pendingSlips.data && (pendingSlips.data.meta?.total ?? 0) > pendingSlips.data.data.length && (
              <Link
                href="/bookings?status=pending_verification"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming (7 days)</CardTitle>
            <CardDescription>Confirmed and pending bookings in the next week</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !upcoming.data || upcoming.data.data.length === 0 ? (
              <EmptyState title="No upcoming bookings" description="Bookings for the next 7 days will appear here." />
            ) : (
              <ul className="space-y-2">
                {upcoming.data.data.map((booking) => (
                  <li key={booking.id}>
                    <Link
                      href={`/bookings/${booking.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{booking.booking_ref}</p>
                        <p className="text-muted-foreground">
                          {booking.time_slot.sub_venue_name} &middot; {formatTime(booking.time_slot.start_time)}
                        </p>
                      </div>
                      <StatusBadge status={booking.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
