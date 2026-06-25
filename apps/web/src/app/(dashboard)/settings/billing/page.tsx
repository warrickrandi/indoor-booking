'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Receipt } from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/store/auth.store'
import {
  usePublicPlans,
  useCurrentSubscription,
  useBillingInvoices,
  useUpgradeSubscription,
  useCancelSubscription,
  type PayhereCheckoutParams,
  type BillingCycle,
} from '@/hooks/useBilling'
import { showApiErrorToast } from '@/lib/api'
import { cn, formatDate, formatDateTime, formatPrice, TIER_RANK } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingPanel } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'

const PAYHERE_CHECKOUT_URL = 'https://www.payhere.lk/pay/checkout'

const TIER_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro:   'Pro',
  elite: 'Elite',
}

export default function BillingPage() {
  const actor = useAuthStore((state) => state.actor)
  const current = useCurrentSubscription()
  const plans = usePublicPlans()
  const invoices = useBillingInvoices()
  const upgrade = useUpgradeSubscription()
  const cancel = useCancelSubscription()

  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [checkoutParams, setCheckoutParams] = useState<PayhereCheckoutParams | null>(null)
  const checkoutFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (checkoutParams && checkoutFormRef.current) {
      checkoutFormRef.current.submit()
    }
  }, [checkoutParams])

  const canManage = actor?.permissions.includes('company.branding') ?? false

  if (!canManage) {
    return <EmptyState title="Access restricted" description="You don't have permission to manage billing." />
  }

  if (current.isLoading || plans.isLoading) {
    return <LoadingPanel />
  }

  const sub = current.data
  if (!sub) {
    return <EmptyState title="Failed to load subscription" description="Please refresh the page and try again." />
  }

  const allPlans = plans.data ?? []

  const handleSelectPlan = (planId: string) => {
    upgrade.mutate(
      { plan_id: planId, billing_cycle: cycle },
      {
        onSuccess: ({ data }) => {
          if (data.checkout_params) {
            setCheckoutParams(data.checkout_params)
            return
          }
          if (data.trial) {
            toast.success(`Your ${data.plan?.name} trial has started — enjoy free access until ${formatDate(data.trial_ends_at!)}`)
            return
          }
          if (data.scheduled) {
            toast.success(`Plan change scheduled for ${formatDate(data.effective_at!)}`)
            return
          }
          toast.success('Subscription updated')
        },
        onError: showApiErrorToast,
      },
    )
  }

  const handleCancel = () => {
    cancel.mutate(undefined, {
      onSuccess: ({ data }) => {
        toast.success(`Your plan will move to Basic on ${formatDate(data.effective_at)}`)
        setCancelOpen(false)
      },
      onError: showApiErrorToast,
    })
  }

  const canCancel = sub.plan.tier !== 'basic' && sub.status !== 'cancelling'

  return (
    <div>
      <PageHeader title="Billing" description="Manage your subscription plan and view invoice history" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{TIER_LABELS[sub.plan.tier] ?? sub.plan.name} Plan</span>
            <StatusBadge status={sub.status} />
          </CardTitle>
          <CardDescription>
            {sub.billing_cycle === 'monthly' ? 'Billed monthly' : 'Billed annually'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {sub.is_trial && sub.trial_ends_at && <p>Your free trial ends on {formatDateTime(sub.trial_ends_at)}.</p>}
          {sub.current_period_end && (
            <p>
              {sub.status === 'cancelling' ? 'Access until' : 'Next renewal'}: {formatDateTime(sub.current_period_end)}
              {sub.days_until_renewal !== null && ` (${sub.days_until_renewal} day${sub.days_until_renewal === 1 ? '' : 's'})`}
            </p>
          )}
          {sub.scheduled_plan && sub.current_period_end && (
            <p className="text-amber-700">
              Switching to the {sub.scheduled_plan.name} plan on {formatDateTime(sub.current_period_end)}
            </p>
          )}
          <p>Next invoice amount: {formatPrice(sub.next_invoice_amount)}</p>
        </CardContent>
        {canCancel && (
          <CardFooter>
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Cancel subscription</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel subscription</DialogTitle>
                  <DialogDescription>
                    Your plan will switch to Basic at the end of your current billing period. You&apos;ll keep{' '}
                    {sub.plan.name} features until then.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelOpen(false)}>
                    Keep plan
                  </Button>
                  <Button variant="destructive" onClick={handleCancel} disabled={cancel.isPending}>
                    {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm cancellation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        )}
      </Card>

      <div className="mb-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Available plans</h2>
          <Tabs value={cycle} onValueChange={(value) => setCycle(value as BillingCycle)}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {allPlans.map((plan) => {
            const isCurrent = plan.id === sub.plan.id
            const isScheduled = plan.id === sub.scheduled_plan?.id
            const price = cycle === 'monthly' ? plan.price_monthly : plan.price_annual
            const isUpgrade = TIER_RANK[plan.tier] > TIER_RANK[sub.plan.tier]
            const showTrial = plan.trial_period_days > 0 && sub.plan.tier === 'basic' && plan.tier !== 'basic'

            let buttonLabel = isUpgrade ? 'Upgrade' : 'Switch plan'
            if (isCurrent) buttonLabel = 'Current plan'
            else if (isScheduled) buttonLabel = 'Scheduled'

            return (
              <Card key={plan.id} className={cn(isCurrent && 'border-primary')}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {TIER_LABELS[plan.tier] ?? plan.name}
                    {isCurrent && <Badge>Current</Badge>}
                  </CardTitle>
                  <CardDescription>
                    {formatPrice(price)} / {cycle === 'monthly' ? 'month' : 'year'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>{plan.max_locations === -1 ? 'Unlimited locations' : `Up to ${plan.max_locations} location${plan.max_locations === 1 ? '' : 's'}`}</p>
                  {showTrial && <p>{plan.trial_period_days}-day free trial</p>}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || isScheduled || upgrade.isPending}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {upgrade.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {buttonLabel}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Invoice history</h2>
        {invoices.isLoading ? (
          <LoadingPanel />
        ) : !invoices.data?.length ? (
          <EmptyState icon={Receipt} title="No invoices yet" description="Your billing invoices will appear here." />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.data.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.plan.name}</TableCell>
                    <TableCell>
                      {formatDate(invoice.billing_period_start)} – {formatDate(invoice.billing_period_end)}
                    </TableCell>
                    <TableCell>{formatPrice(invoice.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell>{invoice.paid_at ? formatDateTime(invoice.paid_at) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {checkoutParams && (
        <form ref={checkoutFormRef} method="POST" action={PAYHERE_CHECKOUT_URL} className="hidden">
          {Object.entries(checkoutParams).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      )}
    </div>
  )
}
