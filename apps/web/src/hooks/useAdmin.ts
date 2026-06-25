import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  UpdateCompanySubscriptionBody,
  UpdateSubscriptionPlanBody,
  UpdateGatewayDriverBody,
} from '@sports-booking/types'

import { adminGet, adminPost, adminPut } from '@/lib/admin-api'
import type { BookingSummary } from './useBookings'

export interface AdminStats {
  total_companies: number
  total_bookings: { all_time: number; this_month: number }
  total_revenue_this_month: number
  companies_by_tier: Record<string, number>
  new_signups_last_30_days: number
  signups_by_day: { date: string; count: number }[]
  active_venues: number
}

export interface AdminCompanySummary {
  id: string
  name: string
  slug: string
  tier: string
  subscription_status: string
  location_count: number
  total_bookings: number
  created_at: string
}

export interface AdminCompanyMember {
  id: string
  status: string
  invited_at: string | null
  joined_at: string | null
  user: { id: string; full_name: string; email: string }
  role: { role_key: string; display_name: string }
  location_ids: string[]
}

export interface AdminCompanyLocation {
  id: string
  name: string
  city: string | null
  status: string
  sub_venue_count: number
}

export interface AdminCompanyBilling {
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  billing_address: string | null
  tax_id: string | null
  bank_name: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  bank_branch: string | null
}

export interface AdminSubscriptionInvoice {
  id: string
  amount: number
  currency: string
  status: string
  billing_period_start: string
  billing_period_end: string
  paid_at: string | null
  created_at: string
}

export interface AdminCompanyBranding {
  primary_color: string | null
  secondary_color: string | null
  logo_url: string | null
  favicon_url: string | null
  tagline: string | null
  meta_title: string | null
  meta_description: string | null
}

export interface AdminCompanyDetail {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  status: string
  plan: { name: string; tier: string }
  tier_key: string
  billing_cycle: string
  subscription_status: string
  trial_ends_at: string | null
  current_period_end: string | null
  branding: AdminCompanyBranding | null
  billing: AdminCompanyBilling | null
  locations: AdminCompanyLocation[]
  members: AdminCompanyMember[]
  recent_bookings: BookingSummary[]
  payment_summary: { status: string; total: number; count: number }[]
  subscription_invoices: AdminSubscriptionInvoice[]
}

export interface SubscriptionPlan {
  id: string
  name: string
  tier: string
  price_monthly: number
  price_annual: number
  max_locations: number
  feature_flags: Record<string, boolean>
  is_active: boolean
}

export interface AuditLogEntry {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  company: { id: string; name: string } | null
  actor: { id: string; full_name: string | null; email: string | null } | null
  actor_type: string | null
  changes: { before: unknown; after: unknown } | null | undefined
  created_at: string
}

export interface AdminBookingSummary extends BookingSummary {
  company: { id: string; name: string }
}

export interface GatewayDriver {
  id: string
  slug: string
  name: string
  is_active: boolean
  created_at: string
}

export interface AdminCompanyFilters {
  status?: string
  tier?: string
  search?: string
  page?: number
  limit?: number
}

export interface AdminAuditLogFilters {
  company_id?: string
  user_id?: string
  action?: string
  from_date?: string
  to_date?: string
  page?: number
  limit?: number
}

export interface AdminBookingFilters {
  company_id?: string
  status?: string
  from_date?: string
  to_date?: string
  page?: number
  limit?: number
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await adminGet<AdminStats>('/admin/stats', { requireAuth: true })).data,
  })
}

export function useAdminCompanies(filters: AdminCompanyFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'companies', filters],
    queryFn: () => adminGet<AdminCompanySummary[]>(`/admin/companies${buildQuery(filters)}`, { requireAuth: true }),
  })
}

export function useAdminCompanyDetail(companyId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'companies', companyId],
    queryFn: async () => (await adminGet<AdminCompanyDetail>(`/admin/companies/${companyId}`, { requireAuth: true })).data,
    enabled: !!companyId,
  })
}

export function useUpdateCompanySubscription(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateCompanySubscriptionBody) =>
      adminPut<AdminCompanyDetail>(`/admin/companies/${companyId}/subscription`, body, { requireAuth: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'companies'] })
    },
  })
}

export function useAdminSubscriptionPlans() {
  return useQuery({
    queryKey: ['admin', 'subscription-plans'],
    queryFn: async () => (await adminGet<SubscriptionPlan[]>('/admin/subscription-plans', { requireAuth: true })).data,
  })
}

export function useUpdateSubscriptionPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, body }: { planId: string; body: UpdateSubscriptionPlanBody }) =>
      adminPut<SubscriptionPlan>(`/admin/subscription-plans/${planId}`, body, { requireAuth: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-plans'] })
    },
  })
}

export function useAdminAuditLogs(filters: AdminAuditLogFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: () => adminGet<AuditLogEntry[]>(`/admin/audit-logs${buildQuery(filters)}`, { requireAuth: true }),
  })
}

export function useAdminBookings(filters: AdminBookingFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'bookings', filters],
    queryFn: () => adminGet<AdminBookingSummary[]>(`/admin/bookings${buildQuery(filters)}`, { requireAuth: true }),
  })
}

export function useAdminGatewayDrivers() {
  return useQuery({
    queryKey: ['admin', 'gateway-drivers'],
    queryFn: async () => (await adminGet<GatewayDriver[]>('/admin/gateway-drivers', { requireAuth: true })).data,
  })
}

export function useUpdateGatewayDriver() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ driverId, body }: { driverId: string; body: UpdateGatewayDriverBody }) =>
      adminPut<GatewayDriver>(`/admin/gateway-drivers/${driverId}`, body, { requireAuth: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'gateway-drivers'] })
    },
  })
}

export function useAdminMarkInvoicePaid(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, paymentRef }: { invoiceId: string; paymentRef?: string }) =>
      adminPost<AdminSubscriptionInvoice>(
        `/admin/billing/invoices/${invoiceId}/mark-paid`,
        { payment_ref: paymentRef ?? null },
        { requireAuth: true },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'companies', companyId] })
    },
  })
}
