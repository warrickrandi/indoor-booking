'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/store/auth.store'
import {
  describeRecurringSlot,
  useApproveRecurringRequest,
  useCancelRecurringRequest,
  useRecurringRequest,
  useRejectRecurringRequest,
  type RecurringOccurrence,
} from '@/hooks/useRecurringRequests'
import { showApiErrorToast } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime, formatTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'

const OCCURRENCE_BADGES: Record<
  RecurringOccurrence['status'],
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  available: { label: 'Free', variant: 'success' },
  not_generated: { label: 'Slots created on approval', variant: 'secondary' },
  conflict: { label: 'Already booked', variant: 'destructive' },
  no_matching_slots: { label: "Time doesn't match slots", variant: 'warning' },
}

export default function PermanentSlotDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const actor = useAuthStore((state) => state.actor)
  const request = useRecurringRequest(requestId)
  const approve = useApproveRecurringRequest(requestId)
  const reject = useRejectRecurringRequest(requestId)
  const cancel = useCancelRecurringRequest(requestId)

  const [dialog, setDialog] = useState<'approve' | 'reject' | 'cancel' | null>(null)
  const noteForm = useForm<{ note: string }>({ defaultValues: { note: '' } })

  if (request.isLoading) return <LoadingPanel />
  if (!request.data) {
    return <EmptyState title="Request not found" description="It may have been removed or you lack access." />
  }

  const data = request.data
  const occurrences = data.occurrences ?? []
  const bookable = occurrences.filter((o) => o.status === 'available' || o.status === 'not_generated')
  const blocked = occurrences.filter((o) => o.status === 'conflict' || o.status === 'no_matching_slots')
  const knownTotal = occurrences.reduce((sum, o) => sum + o.amount, 0)
  const canCancelSeries = actor?.permissions.includes('bookings.cancel') ?? false
  const upcomingBookings = data.bookings.filter(
    (b) => new Date(b.time_slot.start_time) > new Date() && b.status !== 'cancelled',
  )

  const openDialog = (kind: 'approve' | 'reject' | 'cancel') => {
    noteForm.reset({ note: '' })
    setDialog(kind)
  }

  const submitDialog = noteForm.handleSubmit(({ note }) => {
    const trimmed = note.trim()
    if (dialog === 'approve') {
      approve.mutate(
        { review_note: trimmed || undefined },
        {
          onSuccess: ({ data: result }) => {
            const skipped = result.skipped_dates.length
            toast.success(
              `Booked ${result.bookings_created} slot${result.bookings_created === 1 ? '' : 's'}` +
                (skipped ? ` — ${skipped} week${skipped === 1 ? '' : 's'} skipped (not available)` : ''),
            )
            setDialog(null)
          },
          onError: showApiErrorToast,
        },
      )
    } else if (dialog === 'reject') {
      if (!trimmed) {
        noteForm.setError('note', { message: 'Please tell the customer why' })
        return
      }
      reject.mutate(
        { review_note: trimmed },
        {
          onSuccess: () => {
            toast.success('Request rejected')
            setDialog(null)
          },
          onError: showApiErrorToast,
        },
      )
    } else if (dialog === 'cancel') {
      cancel.mutate(
        { reason: trimmed || undefined },
        {
          onSuccess: ({ data: result }) => {
            toast.success(`Permanent slot ended — ${result.bookings_cancelled} upcoming booking(s) cancelled`)
            setDialog(null)
          },
          onError: showApiErrorToast,
        },
      )
    }
  })

  const isPending = approve.isPending || reject.isPending || cancel.isPending

  return (
    <div>
      <Link
        href="/permanent-slots"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Permanent slots
      </Link>

      <PageHeader
        title={`${data.customer.full_name} · ${data.sub_venue_name}`}
        description={`${describeRecurringSlot(data)} · ${formatDate(data.start_date)} – ${formatDate(data.end_date)}`}
        action={
          <>
            <StatusBadge status={data.status} />
            {data.status === 'pending' && (
              <>
                <Button variant="outline" onClick={() => openDialog('reject')}>
                  Reject
                </Button>
                <Button onClick={() => openDialog('approve')} disabled={bookable.length === 0}>
                  Approve &amp; book {bookable.length} week{bookable.length === 1 ? '' : 's'}
                </Button>
              </>
            )}
            {data.status === 'approved' && canCancelSeries && (
              <Button variant="outline" onClick={() => openDialog('cancel')}>
                End permanent slot
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{data.customer.full_name}</p>
            {data.customer.phone && <p>{data.customer.phone}</p>}
            {data.customer.email && <p className="break-all text-muted-foreground">{data.customer.email}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Slot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              {data.sub_venue_name} · {data.location_name}
            </p>
            <p>{describeRecurringSlot(data)}</p>
            <p className="text-muted-foreground">
              {formatDate(data.start_date)} – {formatDate(data.end_date)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Submitted {formatDateTime(data.created_at)} {data.source === 'staff' ? 'by staff' : 'by the customer'}
            </p>
            {data.notes && <p className="whitespace-pre-wrap text-muted-foreground">“{data.notes}”</p>}
            {data.review_note && (
              <p className="whitespace-pre-wrap">
                <span className="text-muted-foreground">Review note:</span> {data.review_note}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {data.status === 'pending' && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Availability check</CardTitle>
            <CardDescription>
              {bookable.length} of {occurrences.length} weeks can be booked
              {blocked.length > 0 && ` · ${blocked.length} will be skipped`}
              {knownTotal > 0 && ` · ${formatCurrency(knownTotal)} for weeks with slots already generated`}. Approved
              weeks become confirmed pay-at-venue bookings.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {occurrences.length === 0 ? (
              <EmptyState title="No upcoming dates" description="The requested period has already passed." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {occurrences.map((occurrence) => {
                      const badge = OCCURRENCE_BADGES[occurrence.status]
                      return (
                        <TableRow key={occurrence.date}>
                          <TableCell className="whitespace-nowrap">{formatDate(occurrence.date)}</TableCell>
                          <TableCell>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {occurrence.amount > 0 ? formatCurrency(occurrence.amount) : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {data.bookings.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
            <CardDescription>
              {upcomingBookings.length} upcoming of {data.bookings.length} total
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking Ref</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">
                        <Link href={`/bookings/${booking.id}`} className="hover:underline">
                          {booking.booking_ref}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(booking.time_slot.start_time)} · {formatTime(booking.time_slot.start_time)} –{' '}
                        {formatTime(booking.time_slot.end_time)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={booking.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(booking.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <form onSubmit={submitDialog}>
            <DialogHeader>
              <DialogTitle>
                {dialog === 'approve' && 'Approve permanent slot'}
                {dialog === 'reject' && 'Reject request'}
                {dialog === 'cancel' && 'End permanent slot'}
              </DialogTitle>
              <DialogDescription>
                {dialog === 'approve' &&
                  `This books ${bookable.length} week${bookable.length === 1 ? '' : 's'} as confirmed pay-at-venue bookings. Weeks that are no longer free are skipped.`}
                {dialog === 'reject' && 'The customer will see your reason on their bookings page.'}
                {dialog === 'cancel' &&
                  `This cancels ${upcomingBookings.length} upcoming booking${upcomingBookings.length === 1 ? '' : 's'} and frees the slots. Past bookings are kept.`}
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 space-y-1.5">
              <Label htmlFor="review-note">
                {dialog === 'reject' ? 'Reason' : dialog === 'cancel' ? 'Reason (optional)' : 'Note (optional)'}
              </Label>
              <Textarea id="review-note" rows={3} {...noteForm.register('note')} />
              {noteForm.formState.errors.note && (
                <p className="text-sm text-destructive">{noteForm.formState.errors.note.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Back
              </Button>
              <Button type="submit" variant={dialog === 'approve' ? 'default' : 'destructive'} disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {dialog === 'approve' ? 'Approve & book' : dialog === 'reject' ? 'Reject' : 'End permanent slot'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
