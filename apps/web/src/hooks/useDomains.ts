import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddDomainBody } from '@sports-booking/types'

import { get, post, del } from '@/lib/api'

export interface CompanyDomain {
  id: string
  domain: string
  type: string
  is_verified: boolean
  ssl_provisioned: boolean
  verified_at: string | null
  created_at: string
}

export interface DomainSettingsResponse {
  subdomain: { value: string }
  custom_domains: CompanyDomain[]
}

export interface AddDomainResponse {
  id: string
  domain: string
  verification_records: Array<{ type: string; name: string; value: string }>
}

export interface VerifyDomainResponse {
  verified: boolean
  ssl_provisioned?: boolean
  message: string
}

function isProvisioning(domains: CompanyDomain[]): boolean {
  return domains.some((d) => !d.is_verified || !d.ssl_provisioned)
}

export function useDomainSettings() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: async () => (await get<DomainSettingsResponse>('/company/me/domains')).data,
    refetchInterval: (query) => (query.state.data && isProvisioning(query.state.data.custom_domains) ? 30_000 : false),
  })
}

export function useAddDomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: AddDomainBody) => post<AddDomainResponse>('/company/me/domains', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
    },
  })
}

export function useVerifyDomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (domainId: string) => post<VerifyDomainResponse>(`/company/me/domains/${domainId}/verify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
    },
  })
}

export function useRemoveDomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (domainId: string) => del<{ message: string }>(`/company/me/domains/${domainId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
    },
  })
}
