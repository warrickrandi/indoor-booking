import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateEmailConfigBody, TestEmailConfigBody } from '@sports-booking/types'

import { get, post, put } from '@/lib/api'

export interface EmailConfigResponse {
  configured: boolean
  mode: string
  from_name: string | null
  from_address: string | null
  reply_to: string | null
  smtp_host: string | null
  smtp_port: number | null
  smtp_user: string | null
  smtp_password: string | null
  smtp_encryption: string
  dkim_selector: string | null
  spf_verified: boolean
  dkim_verified: boolean
  dmarc_verified: boolean
  updated_at: string | null
}

export function useEmailConfig() {
  return useQuery({
    queryKey: ['email-config'],
    queryFn: async () => (await get<EmailConfigResponse>('/company/me/email-config')).data,
  })
}

export function useUpdateEmailConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: UpdateEmailConfigBody) => put<EmailConfigResponse>('/company/me/email-config', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-config'] })
    },
  })
}

export function useVerifyEmailConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => post<EmailConfigResponse>('/company/me/email-config/verify'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-config'] })
    },
  })
}

export function useTestEmailConfig() {
  return useMutation({
    mutationFn: (body: TestEmailConfigBody) => post<{ queued: boolean }>('/company/me/email-config/test', body),
  })
}
