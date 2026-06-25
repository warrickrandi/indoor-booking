import { useQuery } from '@tanstack/react-query'

import { get } from '@/lib/api'

export interface CompanyBranding {
  primary_color: string | null
  secondary_color: string | null
  logo_url: string | null
  favicon_url: string | null
  tagline: string | null
  meta_title: string | null
  meta_description: string | null
}

export interface CompanyDetail {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  status: string
  plan: { name: string; tier: 'basic' | 'pro' | 'elite' }
  tier_key: string
  billing_cycle: string
  subscription_status: string
  trial_ends_at: string | null
  current_period_end: string | null
  branding: CompanyBranding | null
}

export interface CompanyMember {
  id: string
  status: string
  invited_at: string | null
  joined_at: string | null
  user: { id: string; full_name: string; email: string }
  role: { role_key: string; display_name: string }
  location_ids: string[]
}

export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: async () => (await get<CompanyDetail>('/company/me')).data,
  })
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => (await get<CompanyMember[]>('/company/me/members')).data,
  })
}
