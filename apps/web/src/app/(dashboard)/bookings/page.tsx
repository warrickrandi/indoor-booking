'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

import { useLocations } from '@/hooks/useLocations'
import { useBookings } from '@/hooks/useBookings'
import { formatCurrency, formatDate, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  online: 'Online',
  bank_transfer: 'Bank Transfer',
  pay_at_venue: 'Pay at Venue',
}

const PAGE_LIMIT = 20

export default function BookingsPage() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <BookingsPageContent />
    </Suspense>
  )
}

function BookingsPageContent() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status')

  const [tab, setTab] = useState(initialStatus === 'pending_verification' ? 'pending' : 'all')
  const [locationId, setLocationId] = useState('all')
  const [status, setStatus] = useState(initialStatus ?? 'all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const locations = useLocations()

  const filters = {
    location_id: locationId === 'all' ? undefined : locationId,
    status: tab === 'pending' ? 'pending_verification' : status === 'all' ? undefined : status,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    page,
    limit: PAGE_LIMIT,
  }

  const bookings = useBookings(filters)

  const handleTabChange = (value: string) => {
    setTab(value)
    setPage(1)
  }

  const handleLocationChange = (value: string) => {
    setLocationId(value)
    setPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  const handleFromDateChange = (value: string) => {
    setFromDate(value)
    setPage(1)
  }

  const handleToDateChange = (value: string) => {
    setToDate(value)
    setPage(1)
  }

  const rows = bookings.data?.data ?? []
  const meta = bookings.data?.meta
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1

  const renderTable = () => {
    if (bookings.isLoading) {
      return <LoadingPanel />
    }

    if (bookings.isError) {
      return <EmptyState title="Failed to load bookings" description="Please try again." />
    }

    if (rows.length === 0) {
      return <EmptyState title="No bookings found" description="Try adjusting your filters." />
    }

    return (
      <>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking Ref</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Location / Sub-Venue</TableHead>
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((booking) => (
                <TableRow key={booking.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/bookings/${booking.id}`} className="hover:underline">
                      {booking.booking_ref}
                    </Link>
                  </TableCell>
                  <TableCell>{booking.customer.full_name}</TableCell>
                  <TableCell>
                    <div>{booking.time_slot.sub_venue_name}</div>
                    <div className="text-xs text-muted-foreground">{booking.time_slot.location_name}</div>
                  </TableCell>
                  <TableCell>
                    <div>{formatDate(booking.time_slot.start_time)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(booking.time_slot.start_time)} - {formatTime(booking.time_slot.end_time)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={booking.status} />
                  </TableCell>
                  <TableCell>{PAYMENT_METHOD_LABELS[booking.payment_method] ?? booking.payment_method}</TableCell>
                  <TableCell className="text-right">{formatCurrency(booking.total_amount, booking.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {meta && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {meta.page} of {totalPages} &middot; {meta.total} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="View and manage all bookings for your venues"
        action={
          <Link href="/bookings/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Booking
            </Button>
          </Link>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={handleLocationChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {(locations.data ?? []).map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tab === 'all' && (
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger>
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
          )}
          <div className="space-y-1.5">
            <Label>From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => handleFromDateChange(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To Date</Label>
            <Input type="date" value={toDate} onChange={(e) => handleToDateChange(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All Bookings</TabsTrigger>
          <TabsTrigger value="pending">Pending Slips</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6">{renderTable()}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-6">{renderTable()}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
