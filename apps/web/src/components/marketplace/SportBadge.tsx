import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const SPORT_LABELS: Record<string, string> = {
  futsal: 'Futsal',
  badminton: 'Badminton',
  cricket: 'Cricket',
  playhouse: 'Playhouse',
  other: 'Other',
}

const SPORT_COLORS: Record<string, string> = {
  futsal: 'bg-green-100 text-green-800',
  badminton: 'bg-blue-100 text-blue-800',
  cricket: 'bg-amber-100 text-amber-800',
  playhouse: 'bg-pink-100 text-pink-800',
  other: 'bg-slate-100 text-slate-800',
}

interface SportBadgeProps {
  sportType: string
  className?: string
}

export function SportBadge({ sportType, className }: SportBadgeProps) {
  return (
    <Badge variant="outline" className={cn('border-transparent', SPORT_COLORS[sportType] ?? SPORT_COLORS.other, className)}>
      {SPORT_LABELS[sportType] ?? sportType}
    </Badge>
  )
}
