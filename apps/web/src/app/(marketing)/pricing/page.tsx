'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'

import { usePublicPlans, type PublicPlan, type BillingCycle } from '@/hooks/useBilling'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export default function PricingPage() {
  const plans = usePublicPlans()
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold">
            Indoor Sports Booking
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-2 text-muted-foreground">
            Choose the plan that fits your venue. Upgrade or downgrade anytime.
          </p>
          <Tabs value={cycle} onValueChange={(value) => setCycle(value as BillingCycle)} className="mt-6 inline-block">
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {plans.isLoading ? (
          <LoadingPanel />
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            {(plans.data ?? []).map((plan) => {
              const price = cycle === 'monthly' ? plan.price_monthly : plan.price_annual
              return (
                <Card key={plan.id} className={cn(plan.tier === 'pro' && 'border-primary shadow-md')}>
                  <CardHeader>
                    <CardTitle className="capitalize">{plan.name}</CardTitle>
                    <CardDescription>{TIER_DESCRIPTIONS[plan.tier]}</CardDescription>
                    <div className="pt-2">
                      <span className="text-3xl font-bold">{formatCurrency(price)}</span>
                      <span className="text-sm text-muted-foreground"> / {cycle === 'monthly' ? 'month' : 'year'}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {planFeatures(plan).map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button asChild className="w-full">
                      <Link href="/register">Get started</Link>
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
