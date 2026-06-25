'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

interface CountdownTimerProps {
  expiresAt: string
  onExpire: () => void
  className?: string
}

export function CountdownTimer({ expiresAt, onExpire, className }: CountdownTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() => Date.parse(expiresAt) - Date.now())

  useEffect(() => {
    let fired = false

    const interval = setInterval(() => {
      const remaining = Date.parse(expiresAt) - Date.now()
      setRemainingMs(remaining)

      if (remaining <= 0 && !fired) {
        fired = true
        onExpire()
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt, onExpire])

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return (
    <span className={cn('font-mono font-semibold tabular-nums', totalSeconds <= 60 && 'text-destructive', className)}>
      {minutes}:{String(seconds).padStart(2, '0')}
    </span>
  )
}
