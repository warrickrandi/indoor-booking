import type { CSSProperties } from 'react'
import { Building2, MapPin } from 'lucide-react'

import { fetchPublic } from '@/lib/server-api'
import { hexToHslComponents } from '@/lib/utils'
import { SportBadge } from '@/components/marketplace/SportBadge'
import { PermanentBookingCard } from '@/components/marketplace/PermanentBookingCard'
import { VenueGallery, type GalleryMedia } from '@/components/marketplace/VenueGallery'
import { AvailabilitySection, type SubVenueOption } from './availability-section'

interface VenueDetailResponse {
  id: string
  name: string
  slug: string
  tagline: string | null
  media: GalleryMedia[]
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

  const coverImage = venue.media.find((m) => m.type === 'image' && m.is_cover) ?? venue.media.find((m) => m.type === 'image')

  const style = {
    '--primary': hexToHslComponents(venue.branding.primary_color),
  } as CSSProperties

  const brandColor = /^#[0-9a-fA-F]{6}$/.test(venue.branding.primary_color) ? venue.branding.primary_color : '#0f766e'

  return (
    <div style={style}>
      <section
        className="relative isolate overflow-hidden text-white"
        style={{ backgroundImage: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}d9 45%, #0A0F1E 130%)` }}
      >
        {coverImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImage.url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/50 to-ink/30" />
          </>
        ) : (
          <div className="court-lines absolute inset-0 -z-10 opacity-60" />
        )}
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:py-16 sm:flex-row sm:items-center">
          {venue.branding.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={venue.branding.logo_url}
              alt={venue.name}
              className="h-24 w-24 shrink-0 rounded-3xl bg-white object-cover shadow-xl ring-4 ring-white/40"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-white shadow-xl ring-4 ring-white/40">
              <Building2 className="h-12 w-12" style={{ color: brandColor }} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold sm:text-5xl">{venue.name}</h1>
            {venue.tagline && <p className="mt-2 max-w-2xl text-lg text-white/85">{venue.tagline}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {sportTypes.map((sport) => (
                <SportBadge key={sport} sportType={sport} className="bg-white/90 text-ink" />
              ))}
              {cities.length > 0 && (
                <span className="ml-1 inline-flex items-center gap-1.5 text-sm font-medium text-white/90">
                  <MapPin className="h-4 w-4" />
                  {cities.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <VenueGallery media={venue.media} venueName={venue.name} />
        <h2 className="mb-1 text-2xl font-extrabold">Check availability</h2>
        <p className="mb-6 text-muted-foreground">Pick a court and a date to see open slots.</p>
        <AvailabilitySection subVenues={subVenues} initialDate={date} />
        <PermanentBookingCard venueName={venue.name} locations={venue.locations} />
      </div>
    </div>
  )
}
