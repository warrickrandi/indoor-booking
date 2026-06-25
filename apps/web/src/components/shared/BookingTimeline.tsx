import { cn, formatDateTime } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'

export interface BookingStatusLogEntry {
  id: string
  from_status: string | null
  to_status: string
  changed_by: string | null
  reason: string | null
  created_at: string
}

interface BookingTimelineProps {
  entries: BookingStatusLogEntry[]
}

export function BookingTimeline({ entries }: BookingTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No status history yet.</p>
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3 pl-6">
          <span
            className={cn(
              'absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full',
              index === entries.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40',
            )}
          />
          {index < entries.length - 1 && (
            <span className="absolute left-[4px] top-4 h-[calc(100%-0.5rem)] w-px bg-border" />
          )}
          <div className="flex-1 space-y-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              {entry.from_status && (
                <>
                  <StatusBadge status={entry.from_status} />
                  <span className="text-muted-foreground">&rarr;</span>
                </>
              )}
              <StatusBadge status={entry.to_status} />
            </div>
            {entry.reason && <p className="text-sm text-muted-foreground">{entry.reason}</p>}
            <p className="text-xs text-muted-foreground">
              {formatDateTime(entry.created_at)}
              {entry.changed_by && ` · ${entry.changed_by}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
