'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { useSlots } from '@/hooks/useSlots'
import { SlotGrid, type SlotSummary } from '@/components/shared/SlotGrid'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { todayDateString } from '@/lib/utils'

const SPORT_LABELS: Record<string, string> = {
  futsal: 'Futsal',
  badminton: 'Badminton',
  cricket: 'Cricket',
  playhouse: 'Playhouse',
  other: 'Other',
}

export interface SubVenueOption {
  id: string
  name: string
  sport_type: string
  location_id: string
  location_name: string
}

interface AvailabilitySectionProps {
  subVenues: SubVenueOption[]
  initialDate?: string
}

export function AvailabilitySection({ subVenues, initialDate }: AvailabilitySectionProps) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate ?? todayDateString())
  const [activeSubVenueId, setActiveSubVenueId] = useState(subVenues[0]?.id ?? '')

  if (subVenues.length === 0) {
    return <EmptyState title="No courts available" description="This venue hasn't set up any courts yet." />
  }

  const handleSelect = (slot: SlotSummary) => {
    router.push(`/book/${slot.slotId}`)
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="availability-date">Date</Label>
        <Input
          id="availability-date"
          type="date"
          min={todayDateString()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <Tabs value={activeSubVenueId} onValueChange={setActiveSubVenueId}>
        <TabsList className="h-auto flex-wrap">
          {subVenues.map((subVenue) => (
            <TabsTrigger key={subVenue.id} value={subVenue.id}>
              {subVenue.name}
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({SPORT_LABELS[subVenue.sport_type] ?? subVenue.sport_type})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {subVenues.map((subVenue) => (
          <TabsContent key={subVenue.id} value={subVenue.id}>
            {subVenues.length > 1 && <p className="mb-2 text-sm text-muted-foreground">{subVenue.location_name}</p>}
            <SubVenueSlots subVenueId={subVenue.id} date={date} onSelect={handleSelect} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function SubVenueSlots({
  subVenueId,
  date,
  onSelect,
}: {
  subVenueId: string
  date: string
  onSelect: (slot: SlotSummary) => void
}) {
  const slots = useSlots(subVenueId, date)

  if (slots.isLoading) {
    return <LoadingPanel />
  }

  if (slots.isError) {
    return <p className="text-sm text-destructive">Failed to load availability. Please try again.</p>
  }

  return (
    <SlotGrid
      available={slots.data?.available ?? []}
      locked={slots.data?.locked ?? []}
      booked={slots.data?.booked ?? []}
      onSelect={onSelect}
    />
  )
}
