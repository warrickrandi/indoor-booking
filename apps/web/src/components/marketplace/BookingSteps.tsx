import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

const STEPS = [
  { key: 1, label: 'Reserve' },
  { key: 2, label: 'Details' },
  { key: 3, label: 'Confirm' },
] as const

interface BookingStepsProps {
  current: 1 | 2 | 3
}

export function BookingSteps({ current }: BookingStepsProps) {
  return (
    <ol className="mb-6 flex items-center text-sm">
      {STEPS.map((step, index) => (
        <li key={step.key} className="flex items-center">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                step.key < current && 'bg-primary text-primary-foreground',
                step.key === current && 'border-2 border-primary text-primary',
                step.key > current && 'border border-muted-foreground/30 text-muted-foreground',
              )}
            >
              {step.key < current ? <Check className="h-3.5 w-3.5" /> : step.key}
            </span>
            <span className={cn(step.key === current ? 'font-medium' : 'text-muted-foreground')}>{step.label}</span>
          </span>
          {index < STEPS.length - 1 && <span className="mx-3 h-px w-8 bg-border" />}
        </li>
      ))}
    </ol>
  )
}
