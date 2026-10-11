import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'

import { SportBadge } from './SportBadge'
import { VenueCover } from './VenueCover'

export interface VenueCardData {
  slug: string
  name: string
  tagline: string | null
  primary_color: string
  logo_url: string | null
  cover_url?: string | null
  cities: string[]
  sport_types: string[]
}

interface VenueCardProps {
  venue: VenueCardData
  href?: string
}

export function VenueCard({ venue, href }: VenueCardProps) {
  return (
    <Link
      href={href ?? `/venues/${venue.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <VenueCover
        name={venue.name}
        primaryColor={venue.primary_color}
        logoUrl={venue.logo_url}
        coverUrl={venue.cover_url}
        sportTypes={venue.sport_types}
        className="h-36"
      />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="truncate text-lg font-bold">{venue.name}</h3>
          {venue.tagline && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{venue.tagline}</p>}
        </div>
        {venue.cities.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{venue.cities.join(', ')}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {venue.sport_types.map((sport) => (
            <SportBadge key={sport} sportType={sport} />
          ))}
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-primary">
          View &amp; book
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  )
}
