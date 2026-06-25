'use client'

import { useRouter, usePathname } from 'next/navigation'
import { SPORT_TYPES } from '@sports-booking/types'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const SPORT_LABELS: Record<string, string> = {
  futsal: 'Futsal',
  badminton: 'Badminton',
  cricket: 'Cricket',
  playhouse: 'Playhouse',
  other: 'Other',
}

interface VenueFiltersProps {
  sportType?: string
  city?: string
  date?: string
}

export function VenueFilters({ sportType, city, date }: VenueFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()

  const navigate = (updates: Partial<VenueFiltersProps>) => {
    const next = { sportType, city, date, ...updates }
    const params = new URLSearchParams()

    if (next.sportType && next.sportType !== 'all') params.set('sport_type', next.sportType)
    if (next.city) params.set('city', next.city)
    if (next.date) params.set('date', next.date)

    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Sport</Label>
          <Select value={sportType ?? 'all'} onValueChange={(value) => navigate({ sportType: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sports</SelectItem>
              {SPORT_TYPES.map((sport) => (
                <SelectItem key={sport} value={sport}>
                  {SPORT_LABELS[sport] ?? sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="venue-city">City</Label>
          <Input
            id="venue-city"
            placeholder="e.g. Colombo"
            defaultValue={city ?? ''}
            onBlur={(e) => navigate({ city: e.target.value.trim() || undefined })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                navigate({ city: (e.target as HTMLInputElement).value.trim() || undefined })
              }
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="venue-date">Date</Label>
          <Input
            id="venue-date"
            type="date"
            value={date ?? ''}
            onChange={(e) => navigate({ date: e.target.value || undefined })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
