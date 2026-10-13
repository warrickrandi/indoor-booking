'use client'

import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  describeRecurringSlot,
  useMyRecurringRequests,
  useWithdrawRecurringRequest,
} from '@/hooks/useRecurringRequests'
import { showApiErrorToast } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'

const STATUS_HINTS: Record<string, string> = {
  pending: 'Waiting for the venue to review',
  approved: 'Booked — each week appears in your bookings below',
  rejected: 'Not accepted by the venue',
  cancelled: 'Cancelled',
}

/** The player's permanent (weekly) slot requests, shown on My Bookings. Renders nothing when there are none. */
export function MyPermanentSlots() {
  const requests = useMyRecurringRequests()
  const withdraw = useWithdrawRecurringRequest()
  const rows = requests.data?.data ?? []

  if (rows.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Permanent slots</h2>
      <div className="space-y-3">
        {rows.map((request) => (
          <Card key={request.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span>
                  {request.sub_venue_name} · {request.location_name}
                </span>
                <StatusBadge status={request.status} />
              </CardTitle>
              <CardDescription>
                {describeRecurringSlot(request)} · {formatDate(request.start_date)} – {formatDate(request.end_date)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end justify-between gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">{STATUS_HINTS[request.status] ?? request.status}</p>
                {request.review_note && <p>Venue note: {request.review_note}</p>}
              </div>
              {request.status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={withdraw.isPending}
                  onClick={() =>
                    withdraw.mutate(request.id, {
                      onSuccess: () => toast.success('Request withdrawn'),
                      onError: showApiErrorToast,
                    })
                  }
                >
                  {withdraw.isPending && withdraw.variables === request.id && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Withdraw
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
