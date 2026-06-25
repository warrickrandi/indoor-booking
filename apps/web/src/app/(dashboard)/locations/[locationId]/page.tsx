'use client'

import { useParams } from 'next/navigation'

import { useLocation } from '@/hooks/useLocations'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DetailsTab } from './_components/DetailsTab'
import { HoursTab } from './_components/HoursTab'
import { HolidaysTab } from './_components/HolidaysTab'
import { SubVenuesTab } from './_components/SubVenuesTab'

export default function LocationDetailPage() {
  const { locationId } = useParams<{ locationId: string }>()
  const location = useLocation(locationId)

  if (location.isLoading) {
    return <LoadingPanel />
  }

  if (!location.data) {
    return <EmptyState title="Location not found" description="This location may have been removed." />
  }

  return (
    <div>
      <PageHeader
        title={location.data.name}
        description={`${location.data.address}, ${location.data.city}`}
        action={<StatusBadge status={location.data.status} />}
      />
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="sub-venues">Sub-Venues</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <DetailsTab location={location.data} />
        </TabsContent>
        <TabsContent value="hours">
          <HoursTab location={location.data} />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysTab location={location.data} />
        </TabsContent>
        <TabsContent value="sub-venues">
          <SubVenuesTab locationId={location.data.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
