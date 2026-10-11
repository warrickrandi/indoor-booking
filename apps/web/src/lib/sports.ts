import { Castle, Feather, Goal, Sparkles, Trophy, type LucideIcon } from 'lucide-react'

export interface SportMeta {
  key: string
  label: string
  blurb: string
  icon: LucideIcon
  /** Tailwind gradient classes for sport tiles. */
  gradient: string
}

export const SPORTS: SportMeta[] = [
  { key: 'futsal',    label: 'Futsal',    blurb: '5-a-side on fast indoor courts', icon: Goal,   gradient: 'from-emerald-400 to-teal-700' },
  { key: 'badminton', label: 'Badminton', blurb: 'Smash it on pro-grade courts',   icon: Feather, gradient: 'from-sky-400 to-indigo-700' },
  { key: 'cricket',   label: 'Cricket',   blurb: 'Net sessions, rain or shine',    icon: Trophy,  gradient: 'from-amber-400 to-orange-700' },
  { key: 'playhouse', label: 'Playhouse', blurb: 'Kids’ play and birthday parties', icon: Castle,  gradient: 'from-fuchsia-400 to-purple-700' },
]

const OTHER: SportMeta = {
  key: 'other',
  label: 'Other',
  blurb: 'More ways to play',
  icon: Sparkles,
  gradient: 'from-slate-400 to-slate-700',
}

export function getSport(key: string): SportMeta {
  return SPORTS.find((s) => s.key === key) ?? { ...OTHER, key, label: key }
}
