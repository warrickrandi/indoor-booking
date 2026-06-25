'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Dumbbell, Plus } from 'lucide-react'

import { useSubVenues } from '@/hooks/useSubVenues'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'

interface SubVenuesTabProps {
  locationId: string
}

export function SubVenuesTab({ locationId }: SubVenuesTabProps) {
  const router = useRouter()
  const actor = useAuthStore((state) => state.actor)
  const subVenues = useSubVenues(locationId)
  const canWrite = actor?.permissions.includes('sub_venues.write') ?? false

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Sub-Venues</CardTitle>
          <CardDescription>Courts, fields, or rooms available for booking at this location</CardDescription>
        </div>
        {canWrite && (
          <Button size="sm" asChild>
            <Link href={`/locations/${locationId}/sub-venues/new`}>
              <Plus className="h-4 w-4" />
              Add Sub-Venue
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {subVenues.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !subVenues.data || subVenues.data.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No sub-venues yet"
            description="Add a sub-venue to start configuring pricing and generating bookable slots."
            action={
              canWrite ? (
                <Button asChild>
                  <Link href={`/locations/${locationId}/sub-venues/new`}>Add Sub-Venue</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Pricing Rules</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subVenues.data.map((subVenue) => (
                <TableRow
                  key={subVenue.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/locations/${locationId}/sub-venues/${subVenue.id}`)}
                >
                  <TableCell className="font-medium">{subVenue.name}</TableCell>
                  <TableCell className="capitalize">{subVenue.sport_type}</TableCell>
                  <TableCell>{subVenue.capacity ?? '—'}</TableCell>
                  <TableCell>{subVenue.pricing_rules_count}</TableCell>
                  <TableCell>
                    <StatusBadge status={subVenue.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
