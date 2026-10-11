'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'

import { usePublicPlans, type PublicPlan, type BillingCycle } from '@/hooks/useBilling'
import { cn, formatCurrency } from '@/lib/utils'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'

const TIER_DESCRIPTIONS: Record<string, string> = {
  basic: 'Get started with a single venue',
  pro:   'Grow across multiple locations',
  elite: 'Full control for established brands',
}

function planFeatures(plan: PublicPlan): string[] {
  const features: string[] = []
  features.push(
    plan.max_locations === -1
      ? 'Unlimited locations'
      : `${plan.max_locations} location${plan.max_locations === 1 ? '' : 's'}`,
  )
  features.push('Marketplace booking profile')
  if (plan.feature_flags['subdomain']) features.push('Branded subdomain')
  if (plan.feature_flags['custom_domain']) features.push('Custom domain')
  if (plan.feature_flags['location_manager_role']) features.push('Location manager role')
  if (plan.feature_flags['rbac']) features.push('Full RBAC & custom roles')
  if (plan.feature_flags['custom_email']) features.push('Custom email sending domain')
  if (plan.feature_flags['reports_full']) features.push('Full reporting & ledger export')
  if (plan.trial_period_days > 0) features.push(`${plan.trial_period_days}-day free trial`)
  return features
}

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
]

export default function PricingPage() {
  const plans = usePublicPlans()
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="court-lines absolute inset-0 -z-10 opacity-70" />
        <div className="absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-volt/20 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="text-4xl font-extrabold sm:text-6xl">
            Simple pricing. <span className="text-volt">Serious bookings.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Choose the plan that fits your venue. Start with a free trial, and upgrade or downgrade anytime.
          </p>
          <div role="group" aria-label="Billing period" className="mt-8 inline-flex rounded-full bg-white/10 p-1">
            {CYCLES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={cycle === option.value}
                onClick={() => setCycle(option.value)}
                className={cn(
                  'rounded-full px-6 py-2 text-sm font-semibold transition-colors',
                  cycle === option.value ? 'bg-volt text-ink' : 'text-white/80 hover:text-white',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        {plans.isLoading ? (
          <LoadingPanel />
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {(plans.data ?? []).map((plan) => {
              const price = cycle === 'monthly' ? plan.price_monthly : plan.price_annual
              const featured = plan.tier === 'pro'
              return (
                <div
                  key={plan.id}
                  className={cn(
                    'relative flex flex-col rounded-3xl border bg-card p-8 shadow-sm',
                    featured && 'border-2 border-ink shadow-xl md:-translate-y-3',
                  )}
                >
                  {featured && (
                    <span className="absolute -top-3 left-8 rounded-full bg-volt px-3 py-1 text-xs font-bold text-ink">
                      Most popular
                    </span>
                  )}
                  <h2 className="font-display text-2xl font-bold capitalize">{plan.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{TIER_DESCRIPTIONS[plan.tier]}</p>
                  <p className="mt-6">
                    <span className="font-display text-4xl font-extrabold">{formatCurrency(price)}</span>
                    <span className="text-sm text-muted-foreground"> / {cycle === 'monthly' ? 'month' : 'year'}</span>
                  </p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    {planFeatures(plan).map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-volt">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={cn(
                      'mt-8 rounded-full px-6 py-3 text-center text-sm font-semibold transition-colors',
                      featured ? 'bg-ink text-white hover:bg-ink-soft' : 'border-2 border-ink text-ink hover:bg-ink hover:text-white',
                    )}
                  >
                    Get started
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
