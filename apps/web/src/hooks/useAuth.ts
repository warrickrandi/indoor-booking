'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import type { LoginBody, RegisterBody } from '@sports-booking/types'

import { post, showApiErrorToast } from '@/lib/api'
import { setSession as setTokenSession, clearSession as clearTokenSession } from '@/lib/auth'
import { useAuthStore, type AuthUser, type AuthCompany } from '@/store/auth.store'

interface AuthResponse {
  access_token: string
  refresh_token: string
  user: AuthUser
  company: AuthCompany
}

export function useAuth() {
  const router = useRouter()
  const setStoreSession = useAuthStore((state) => state.setSession)
  const clearStore = useAuthStore((state) => state.clear)

  const login = useMutation({
    mutationFn: (body: LoginBody) => post<AuthResponse>('/auth/login', body),
    onSuccess: ({ data }) => {
      setTokenSession({ access_token: data.access_token, refresh_token: data.refresh_token })
      setStoreSession({ user: data.user, company: data.company, access_token: data.access_token })
      router.push('/overview')
    },
    onError: showApiErrorToast,
  })

  const register = useMutation({
    mutationFn: (body: RegisterBody) => post<AuthResponse>('/auth/register', body),
    onSuccess: ({ data }) => {
      setTokenSession({ access_token: data.access_token, refresh_token: data.refresh_token })
      setStoreSession({ user: data.user, company: data.company, access_token: data.access_token })
      router.push('/overview')
    },
    onError: showApiErrorToast,
  })

  const logout = useMutation({
    mutationFn: async () => {
      try {
        await post('/auth/logout')
      } catch {
        // best-effort: proceed with local logout regardless of API result
      }
    },
    onSettled: () => {
      clearTokenSession()
      clearStore()
      router.push('/login')
    },
  })

  return { login, register, logout }
}
