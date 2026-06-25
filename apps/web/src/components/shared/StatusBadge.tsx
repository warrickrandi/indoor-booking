import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_VARIANTS: Record<string, NonNullable<BadgeProps['variant']>> = {
  confirmed: 'success',
  paid: 'success',
  approved: 'success',
  completed: 'success',
  active: 'success',
  checked_in: 'info',
  pending_payment: 'warning',
  pending_verification: 'warning',
  pending: 'warning',
  cancelled: 'destructive',
  failed: 'destructive',
  rejected: 'destructive',
  no_show: 'destructive',
  inactive: 'secondary',
  locked: 'warning',
  booked: 'secondary',
  available: 'success',
}

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = STATUS_VARIANTS[status] ?? 'secondary'
  return (
    <Badge variant={variant} className={cn(className)}>
      {formatStatusLabel(status)}
    </Badge>
  )
}
