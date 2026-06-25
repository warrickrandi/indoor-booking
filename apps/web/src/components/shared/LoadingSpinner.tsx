import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  size?: number
}

export function LoadingSpinner({ className, size = 24 }: LoadingSpinnerProps) {
  return <Loader2 className={cn('animate-spin text-muted-foreground', className)} size={size} />
}

export function LoadingPanel({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <LoadingSpinner size={28} />
    </div>
  )
}
