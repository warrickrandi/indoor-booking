'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { RecurringRequestStatus } from '@sports-booking/types'

import { useLocations } from '@/hooks/useLocations'
import { describeRecurringSlot, useRecurringRequests } from '@/hooks/useRecurringRequests'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'

const TABS: { value: RecurringRequestStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Awaiting review' },
  { value: 'approved', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

const PAGE_LIMIT = 20

export default function PermanentSlotsPage() {
  const [tab, setTab] = useState<RecurringRequestStatus | 'all'>('pending')
  const [locationId, setLocationId] = useState('all')
  const [page, setPage] = useState(1)

  const locations = useLocations()
  const requests = useRecurringRequests({
    status: tab === 'all' ? undefined : tab,
    location_id: locationId === 'all' ? undefined : locationId,
    page,
    limit: PAGE_LIMIT,
  })

  const rows = requests.data?.data ?? []
  const meta = requests.data?.meta
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1

  return (
    <div>
      <PageHeader
        title="Permanent Slots"
        description="Weekly slots requested by customers. Review a request to book every matching week in one go."
        action={
          <Link href="/permanent-slots/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Permanent Slot
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as RecurringRequestStatus | 'all')
            setPage(1)
          }}
        >
          <TabsList className="flex-wrap">
            {TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select
          value={locationId}
          onValueChange={(value) => {
            setLocationId(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
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

      <Card>
        <CardContent className="p-0">
          {requests.isLoading ? (
            <LoadingPanel />
          ) : requests.isError ? (
            <EmptyState title="Failed to load requests" description="Please try again." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={tab === 'pending' ? 'No requests waiting for review' : 'No permanent slots found'}
              description="Requests customers submit from your venue page appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Court</TableHead>
                    <TableHead>Weekly slot</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        <Link href={`/permanent-slots/${request.id}`} className="hover:underline">
                          {request.customer.full_name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{request.customer.phone ?? request.customer.email}</div>
                      </TableCell>
                      <TableCell>
                        <div>{request.sub_venue_name}</div>
                        <div className="text-xs text-muted-foreground">{request.location_name}</div>
                      </TableCell>
                      <TableCell>{describeRecurringSlot(request)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(request.start_date)} – {formatDate(request.end_date)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(request.created_at)}
                        {request.source === 'staff' && <div className="text-xs">by staff</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {meta && meta.total > PAGE_LIMIT && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
