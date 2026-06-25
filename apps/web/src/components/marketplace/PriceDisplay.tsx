import { cn, formatPrice } from '@/lib/utils'

interface PriceDisplayProps {
  amount: number
  className?: string
}

export function PriceDisplay({ amount, className }: PriceDisplayProps) {
  return <span className={cn('font-semibold', className)}>{formatPrice(amount)}</span>
}
