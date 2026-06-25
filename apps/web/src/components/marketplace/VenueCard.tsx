import Link from 'next/link'
import { Building2, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { SportBadge } from './SportBadge'

export interface VenueCardData {
  slug: string
  name: string
  tagline: string | null
  primary_color: string
  logo_url: string | null
  cities: string[]
  sport_types: string[]
}

interface VenueCardProps {
  venue: VenueCardData
  href?: string
}

export function VenueCard({ venue, href }: VenueCardProps) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md text-white"
          style={{ backgroundColor: venue.primary_color }}
        >
          {venue.logo_url ? (
            <img src={venue.logo_url} alt={venue.name} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{venue.name}</CardTitle>
          {venue.tagline && <p className="truncate text-sm text-muted-foreground">{venue.tagline}</p>}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {venue.cities.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {venue.cities.join(', ')}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {venue.sport_types.map((sport) => (
            <SportBadge key={sport} sportType={sport} />
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={href ?? `/venues/${venue.slug}`}>View Venue</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
