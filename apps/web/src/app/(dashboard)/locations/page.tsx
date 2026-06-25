'use client'

import Link from 'next/link'
import { MapPin, Plus } from 'lucide-react'

import { useAuthStore } from '@/store/auth.store'
import { useLocations } from '@/hooks/useLocations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function LocationsPage() {
  const actor = useAuthStore((state) => state.actor)
  const locations = useLocations()

  const canWrite = actor?.permissions.includes('locations.write') ?? false

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Manage the venues where you offer bookable sub-venues"
        action={
          canWrite ? (
            <Button asChild>
              <Link href="/locations/new">
                <Plus className="h-4 w-4" />
                Add Location
              </Link>
            </Button>
          ) : undefined
        }
      />

      {locations.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !locations.data || locations.data.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add your first location to start configuring sub-venues and pricing."
          action={
            canWrite ? (
              <Button asChild>
                <Link href="/locations/new">Add Location</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.data.map((location) => (
            <Link key={location.id} href={`/locations/${location.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {location.name}
                    <Badge variant={location.status === 'active' ? 'success' : 'secondary'}>
                      {location.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    {location.address}, {location.city}
                  </p>
                  {location.phone && <p>{location.phone}</p>}
                  <p>
                    {location.sub_venues_count} sub-venue{location.sub_venues_count === 1 ? '' : 's'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
