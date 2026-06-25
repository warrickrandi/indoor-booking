import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { get, put } from '@/lib/api'

export interface GatewaySummary {
  slug: string
  name: string
  is_active: boolean
  is_stub: boolean
  configured: boolean
  is_venue_config_active: boolean
}

export function useAvailableGateways() {
  return useQuery({
    queryKey: ['gateways'],
    queryFn: async () => (await get<GatewaySummary[]>('/payments/gateways')).data,
  })
}

export interface GatewayConfigDetail {
  configured: boolean
  gateway_slug?: string
  is_active?: boolean
  credentials?: Record<string, string>
  updated_at?: string
}

export function useGatewayConfigBySlug(slug: string | null) {
  return useQuery({
    queryKey: ['gateway-config', slug],
    queryFn: async () => (await get<GatewayConfigDetail>(`/payments/gateway-config/${slug}`)).data,
    enabled: !!slug,
  })
}

export function useUpdateGatewayConfig(slug: string) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (credentials: Record<string, string>) =>
      put(`/payments/gateway-config/${slug}`, { credentials }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gateway-config', slug] })
      qc.invalidateQueries({ queryKey: ['gateways'] })
    },
  })
}
