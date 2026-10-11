import { Building2 } from 'lucide-react'

import { getSport } from '@/lib/sports'
import { cn } from '@/lib/utils'

interface VenueCoverProps {
  name: string
  primaryColor: string
  logoUrl: string | null
  sportTypes: string[]
  className?: string
}

/** Photo-less venue artwork: brand-colour gradient + oversized sport icon + court-line texture. */
export function VenueCover({ name, primaryColor, logoUrl, sportTypes, className }: VenueCoverProps) {
  const Icon = getSport(sportTypes[0] ?? 'other').icon
  const isHex = /^#[0-9a-fA-F]{6}$/.test(primaryColor)
  const base = isHex ? primaryColor : '#0f766e'

  return (
    <div
      className={cn('relative isolate overflow-hidden', className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${base} 0%, ${base}cc 40%, #0A0F1E 135%)` }}
    >
      <div className="court-lines absolute inset-0 -z-10 opacity-60" />
      <Icon
        aria-hidden
        strokeWidth={1.25}
        className="absolute -right-4 -top-4 h-36 w-36 rotate-12 text-white/20 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110"
      />
      <div className="absolute bottom-3 left-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg ring-2 ring-white/60">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-6 w-6" style={{ color: base }} />
        )}
      </div>
    </div>
  )
}
