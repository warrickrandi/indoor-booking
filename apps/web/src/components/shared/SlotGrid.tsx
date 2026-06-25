'use client'

import { cn, formatPrice, formatTime } from '@/lib/utils'

export interface SlotSummary {
  slotId: string
  sub_venue_id: string
  start_time: string
  end_time: string
  price: number
  rate_type: string
  status: string
}

interface SlotGridProps {
  available: SlotSummary[]
  locked: SlotSummary[]
  booked: SlotSummary[]
  selectedSlotId?: string | null
  onSelect?: (slot: SlotSummary) => void
}

export function SlotGrid({ available, locked, booked, selectedSlotId, onSelect }: SlotGridProps) {
  const allSlots = [...available, ...locked, ...booked].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )

  if (allSlots.length === 0) {
    return <p className="text-sm text-muted-foreground">No slots available for this date.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {allSlots.map((slot) => {
        const isAvailable = slot.status === 'available'
        const isLocked = slot.status === 'locked'
        const isBooked = slot.status === 'booked'
        const isSelected = slot.slotId === selectedSlotId

        return (
          <button
            key={slot.slotId}
            type="button"
            disabled={!isAvailable}
            onClick={() => onSelect?.(slot)}
            className={cn(
              'flex flex-col items-center rounded-md border p-2 text-xs font-medium transition-colors',
              isAvailable && 'border-input bg-background hover:border-primary hover:bg-primary/5',
              isLocked && 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-700',
              isBooked && 'cursor-not-allowed border-muted bg-muted text-muted-foreground',
              isSelected && 'border-primary bg-primary/10 ring-2 ring-primary',
            )}
          >
            <span>{formatTime(slot.start_time)}</span>
            <span className="text-muted-foreground">{formatTime(slot.end_time)}</span>
            <span className="mt-1 font-semibold">{formatPrice(slot.price)}</span>
            {isLocked && <span className="mt-1 text-[10px] uppercase tracking-wide">Locked</span>}
            {isBooked && <span className="mt-1 text-[10px] uppercase tracking-wide">Booked</span>}
          </button>
        )
      })}
    </div>
  )
}
