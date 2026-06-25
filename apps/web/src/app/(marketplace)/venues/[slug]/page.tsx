import type { CSSProperties } from 'react'
import { Building2, MapPin } from 'lucide-react'

import { fetchPublic } from '@/lib/server-api'
import { hexToHslComponents } from '@/lib/utils'
import { SportBadge } from '@/components/marketplace/SportBadge'
import { AvailabilitySection, type SubVenueOption } from './availability-section'

interface VenueDetailResponse {
  id: string
  name: string
  slug: string
  tagline: string | null
  branding: {
    primary_color: string
    secondary_color: string
    logo_url: string | null
    favicon_url: string | null
    meta_title: string | null
    meta_description: string | null
  }
  locations: Array<{
    id: string
    name: string
    address: string
    city: string
    phone: string | null
    timezone: string
    operating_hours: Array<{ day_of_week: number; open_time: string; close_time: string; is_closed: boolean }>
    sub_venues: Array<{
      id: string
      name: string
      sport_type: string
      description: string | null
      capacity: number | null
      amenities: string[]
      display_order: number
    }>
  }>
}

interface VenuePageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ date?: string }>
}

export default async function VenuePage({ params, searchParams }: VenuePageProps) {
  const { slug } = await params
  const { date } = await searchParams

  const { data: venue } = await fetchPublic<VenueDetailResponse>(`/marketplace/venues/${slug}`)

  const cities = [...new Set(venue.locations.map((location) => location.city))]
  const sportTypes = [...new Set(venue.locations.flatMap((location) => location.sub_venues.map((sv) => sv.sport_type)))]

  const subVenues: SubVenueOption[] = venue.locations.flatMap((location) =>
    location.sub_venues.map((subVenue) => ({
      id: subVenue.id,
      name: subVenue.name,
      sport_type: subVenue.sport_type,
      location_id: location.id,
      location_name: location.name,
    })),
  )

  const style = {
    '--primary': hexToHslComponents(venue.branding.primary_color),
  } as CSSProperties

  return (
    <div style={style} className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-start gap-4">
        {venue.branding.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.branding.logo_url}
            alt={venue.name}
            className="h-16 w-16 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-8 w-8" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{venue.name}</h1>
          {venue.tagline && <p className="text-muted-foreground">{venue.tagline}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {sportTypes.map((sport) => (
              <SportBadge key={sport} sportType={sport} />
            ))}
          </div>
          {cities.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {cities.join(', ')}
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Check availability</h2>
      <AvailabilitySection subVenues={subVenues} initialDate={date} />
    </div>
  )
}
