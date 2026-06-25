'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import type { LoginBody } from '@sports-booking/types'

import { showApiErrorToast } from '@/lib/api'
import { adminPost } from '@/lib/admin-api'
import { setAdminSession, clearAdminSession } from '@/lib/platform-admin-auth'
import { usePlatformAdminAuthStore, type PlatformAdminUser } from '@/store/platform-admin-auth.store'

interface AdminAuthResponse {
  access_token: string
  user: PlatformAdminUser
}

export function useAdminLogin() {
  const router = useRouter()
  const setStoreSession = usePlatformAdminAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: (body: LoginBody) => adminPost<AdminAuthResponse>('/auth/admin-login', body),
    onSuccess: ({ data }) => {
      setAdminSession({ access_token: data.access_token })
      setStoreSession({ user: data.user, access_token: data.access_token })
      router.push('/admin/stats')
    },
    onError: showApiErrorToast,
  })
}

export function useAdminLogout() {
  const router = useRouter()
  const clearStore = usePlatformAdminAuthStore((state) => state.clear)

  return () => {
    clearAdminSession()
    clearStore()
    router.push('/admin/login')
  }
}
