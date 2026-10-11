'use client'

import { useRouter, usePathname } from 'next/navigation'
import { CalendarDays, MapPin } from 'lucide-react'

import { SPORTS } from '@/lib/sports'
import { cn, todayDateString } from '@/lib/utils'

interface VenueFiltersProps {
  sportType?: string
  city?: string
  date?: string
}

const INPUT_WRAP =
  'flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white focus-within:border-volt'
const INPUT_CLASS = 'w-full bg-transparent text-white placeholder:text-white/50 focus:outline-none [color-scheme:dark]'

export function VenueFilters({ sportType, city, date }: VenueFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()

  const navigate = (updates: Partial<VenueFiltersProps>) => {
    const next = { sportType, city, date, ...updates }
    const params = new URLSearchParams()

    if (next.sportType) params.set('sport_type', next.sportType)
    if (next.city) params.set('city', next.city)
    if (next.date) params.set('date', next.date)

    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const chips = [{ key: '', label: 'All sports' }, ...SPORTS.map((s) => ({ key: s.key, label: s.label }))]

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {chips.map((chip) => {
          const active = (sportType ?? '') === chip.key
          return (
            <button
              key={chip.key || 'all'}
              type="button"
              onClick={() => navigate({ sportType: chip.key || undefined })}
              aria-pressed={active}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                active
                  ? 'border-volt bg-volt text-ink'
                  : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white',
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <label className={INPUT_WRAP}>
          <MapPin className="h-4 w-4 shrink-0 text-volt" />
          <input
            aria-label="City"
            placeholder="City, e.g. Colombo"
            defaultValue={city ?? ''}
            className={INPUT_CLASS}
            onBlur={(e) => {
              const value = e.target.value.trim()
              if (value !== (city ?? '')) navigate({ city: value || undefined })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                navigate({ city: (e.target as HTMLInputElement).value.trim() || undefined })
              }
            }}
          />
        </label>
        <label className={INPUT_WRAP}>
          <CalendarDays className="h-4 w-4 shrink-0 text-volt" />
          <input
            aria-label="Date"
            type="date"
            min={todayDateString()}
            value={date ?? ''}
            onChange={(e) => navigate({ date: e.target.value || undefined })}
            className={INPUT_CLASS}
          />
        </label>
      </div>
    </div>
  )
}
