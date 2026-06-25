import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpgradeSubscriptionBody, BillingCycle } from '@sports-booking/types'

import { get, post, type ApiResponse } from '@/lib/api'

export type { BillingCycle }

export interface PublicPlan {
  id: string
  name: string
  tier: 'basic' | 'pro' | 'elite'
  price_monthly: number
  price_annual: number
  max_locations: number
  trial_period_days: number
  feature_flags: Record<string, boolean>
}

export interface SubscriptionPlanRef {
  id: string
  name: string
  tier: 'basic' | 'pro' | 'elite'
}

export interface CurrentSubscription {
  plan: SubscriptionPlanRef
  billing_cycle: BillingCycle
  status: 'trialing' | 'cancelling' | 'active'
  current_period_end: string | null
  days_until_renewal: number | null
  is_trial: boolean
  trial_ends_at: string | null
  next_invoice_amount: number
  scheduled_plan: SubscriptionPlanRef | null
}

export interface BillingInvoice {
  id: string
  plan: { name: string; tier: string }
  amount: number
  currency: string
  status: string
  billing_period_start: string
  billing_period_end: string
  paid_at: string | null
  created_at: string
}

export interface PayhereCheckoutParams {
  merchant_id: string
  return_url: string
  cancel_url: string
  notify_url: string
  order_id: string
  items: string
  currency: string
  amount: string
  first_name: string
  last_name: string
  email: string
  phone: string
  custom_1: string
  hash: string
}

export interface UpgradeSubscriptionResult {
  scheduled?: boolean
  effective_at?: string
  trial?: boolean
  trial_ends_at?: string
  plan?: SubscriptionPlanRef
  invoice?: BillingInvoice
  checkout_params?: PayhereCheckoutParams
}

export interface CancelSubscriptionResult {
  scheduled: boolean
  effective_at: string
}

export function usePublicPlans() {
  return useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: async () => (await get<PublicPlan[]>('/billing/plans')).data,
  })
}

export function useCurrentSubscription() {
  return useQuery({
    queryKey: ['billing', 'current'],
    queryFn: async () => (await get<CurrentSubscription>('/billing/current')).data,
  })
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: async () => (await get<BillingInvoice[]>('/billing/invoices')).data,
  })
}

export function useUpgradeSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: UpgradeSubscriptionBody): Promise<ApiResponse<UpgradeSubscriptionResult>> =>
      post<UpgradeSubscriptionResult>('/billing/upgrade', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
    },
  })
}

export function useCancelSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (): Promise<ApiResponse<CancelSubscriptionResult>> => post<CancelSubscriptionResult>('/billing/cancel'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
    },
  })
}
