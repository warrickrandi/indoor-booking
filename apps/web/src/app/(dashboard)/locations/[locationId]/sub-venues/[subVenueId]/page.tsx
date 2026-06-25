'use client'

import { useParams } from 'next/navigation'

import { useSubVenue } from '@/hooks/useSubVenues'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DetailsTab } from './_components/DetailsTab'
import { PricingTab } from './_components/PricingTab'
import { GenerateSlotsTab } from './_components/GenerateSlotsTab'

export default function SubVenueDetailPage() {
  const { locationId, subVenueId } = useParams<{ locationId: string; subVenueId: string }>()
  const subVenue = useSubVenue(locationId, subVenueId)

  if (subVenue.isLoading) {
    return <LoadingPanel />
  }

  if (!subVenue.data) {
    return <EmptyState title="Sub-venue not found" description="This sub-venue may have been removed." />
  }

  return (
    <div>
      <PageHeader
        title={subVenue.data.name}
        description={`${subVenue.data.sport_type} sub-venue`}
        action={<StatusBadge status={subVenue.data.status} />}
      />
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="generate-slots">Generate Slots</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <DetailsTab locationId={locationId} subVenue={subVenue.data} />
        </TabsContent>
        <TabsContent value="pricing">
          <PricingTab locationId={locationId} subVenue={subVenue.data} />
        </TabsContent>
        <TabsContent value="generate-slots">
          <GenerateSlotsTab locationId={locationId} subVenueId={subVenue.data.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
