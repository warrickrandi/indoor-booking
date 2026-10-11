'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, Search, Trophy } from 'lucide-react'

import { SPORTS } from '@/lib/sports'
import { todayDateString } from '@/lib/utils'

const FIELD_CLASS =
  'w-full bg-transparent text-sm font-medium text-ink placeholder:text-slate-400 focus:outline-none'

export function HeroSearch() {
  const router = useRouter()
  const [sportType, setSportType] = useState('')
  const [city, setCity] = useState('')
  const [date, setDate] = useState('')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (sportType) params.set('sport_type', sportType)
    if (city.trim()) params.set('city', city.trim())
    if (date) params.set('date', date)
    const qs = params.toString()
    router.push(qs ? `/venues?${qs}` : '/venues')
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-2 rounded-3xl bg-white p-2 shadow-2xl shadow-black/30 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
    >
      <label className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors focus-within:bg-slate-50">
        <Trophy className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex w-full flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sport</span>
          <select value={sportType} onChange={(e) => setSportType(e.target.value)} className={FIELD_CLASS}>
            <option value="">Any sport</option>
            {SPORTS.map((sport) => (
              <option key={sport.key} value={sport.key}>
                {sport.label}
              </option>
            ))}
          </select>
        </span>
      </label>

      <label className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors focus-within:bg-slate-50">
        <MapPin className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex w-full flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">City</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Colombo"
            className={FIELD_CLASS}
          />
        </span>
      </label>

      <label className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors focus-within:bg-slate-50">
        <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex w-full flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date</span>
          <input
            type="date"
            value={date}
            min={todayDateString()}
            onChange={(e) => setDate(e.target.value)}
            className={FIELD_CLASS}
          />
        </span>
      </label>

      <button
        type="submit"
        className="flex items-center justify-center gap-2 rounded-2xl bg-ink px-8 py-4 text-sm font-semibold text-white transition-colors hover:bg-ink-soft sm:col-span-2 lg:col-span-1"
      >
        <Search className="h-4 w-4" />
        Search
      </button>
    </form>
  )
}
