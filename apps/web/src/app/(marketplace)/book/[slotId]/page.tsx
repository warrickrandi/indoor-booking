import type { CSSProperties } from 'react'

import { fetchPublic } from '@/lib/server-api'
import { hexToHslComponents } from '@/lib/utils'
import { BookingWizard, type SlotDetail } from './booking-wizard'

interface BookSlotPageProps {
  params: Promise<{ slotId: string }>
}

export default async function BookSlotPage({ params }: BookSlotPageProps) {
  const { slotId } = await params
  const { data: slot } = await fetchPublic<SlotDetail>(`/slots/${slotId}`)

  const branding = slot.sub_venue.location.company.branding
  const style = branding
    ? ({ '--primary': hexToHslComponents(branding.primary_color) } as CSSProperties)
    : undefined

  return (
    <div style={style}>
      <BookingWizard slot={slot} />
    </div>
  )
}
