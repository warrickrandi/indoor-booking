'use client'

import { useEffect, useState } from 'react'

import { useAuthStore } from '@/store/auth.store'
import { useLocations } from '@/hooks/useLocations'
import { useSubVenues } from '@/hooks/useSubVenues'
import { useSlotCalendar } from '@/hooks/useSlots'
import { showApiErrorToast } from '@/lib/api'
import { addDaysToDateString, formatDate, todayDateString } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const MAX_RANGE_DAYS = 60

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export default function SlotsPage() {
  const actor = useAuthStore((state) => state.actor)
  const canView = actor?.permissions.includes('slots.read') ?? false

  const today = todayDateString()
  const [locationId, setLocationId] = useState('')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(addDaysToDateString(today, 7))

  const locations = useLocations()
  const subVenues = useSubVenues(locationId || undefined)
  const calendar = useSlotCalendar(canView && locationId ? locationId : undefined, fromDate, toDate)

  useEffect(() => {
    if (!locationId && locations.data && locations.data.length > 0) {
      setLocationId(locations.data[0].id)
    }
  }, [locationId, locations.data])

  useEffect(() => {
    if (calendar.isError) {
      showApiErrorToast(calendar.error)
    }
  }, [calendar.isError, calendar.error])

  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view slot availability." />
  }

  const handleFromDateChange = (value: string) => {
    setFromDate(value)
    if (toDate < value) {
      setToDate(value)
    } else if (daysBetween(value, toDate) > MAX_RANGE_DAYS) {
      setToDate(addDaysToDateString(value, MAX_RANGE_DAYS))
    }
  }

  const handleToDateChange = (value: string) => {
    if (value < fromDate) {
      setToDate(fromDate)
    } else if (daysBetween(fromDate, value) > MAX_RANGE_DAYS) {
      setToDate(addDaysToDateString(fromDate, MAX_RANGE_DAYS))
    } else {
      setToDate(value)
    }
  }

  const dates: string[] = []
  for (let d = fromDate; d <= toDate && dates.length <= MAX_RANGE_DAYS; d = addDaysToDateString(d, 1)) {
    dates.push(d)
  }

  const subVenueList = subVenues.data ?? []

  return (
    <div>
      <PageHeader title="Slot Availability" description="Bookable slot counts by sub-venue and date" />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {(locations.data ?? []).map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>From Date</Label>
            <Input type="date" value={fromDate} onChange={(e) => handleFromDateChange(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To Date</Label>
            <Input
              type="date"
              value={toDate}
              min={fromDate}
              max={addDaysToDateString(fromDate, MAX_RANGE_DAYS)}
              onChange={(e) => handleToDateChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {locations.isLoading ? (
        <LoadingPanel />
      ) : (locations.data ?? []).length === 0 ? (
        <EmptyState title="No locations" description="Add a location to start generating bookable slots." />
      ) : subVenues.isLoading || calendar.isLoading ? (
        <LoadingPanel />
      ) : subVenueList.length === 0 ? (
        <EmptyState title="No sub-venues" description="This location has no sub-venues configured yet." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {subVenueList.map((subVenue) => (
                    <TableHead key={subVenue.id} className="text-center">
                      {subVenue.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dates.map((date) => (
                  <TableRow key={date}>
                    <TableCell className="font-medium">{formatDate(`${date}T00:00:00`)}</TableCell>
                    {subVenueList.map((subVenue) => {
                      const entry = calendar.data?.find((e) => e.date === date && e.sub_venue_id === subVenue.id)
                      return (
                        <TableCell key={subVenue.id} className="text-center text-xs">
                          {entry ? (
                            <div className="space-y-0.5">
                              <div className="font-medium text-foreground">{entry.available} available</div>
                              {entry.booked > 0 && <div className="text-muted-foreground">{entry.booked} booked</div>}
                              {entry.locked > 0 && <div className="text-amber-600">{entry.locked} locked</div>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
