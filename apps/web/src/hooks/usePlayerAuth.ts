'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import type { CustomerRegisterBody, CustomerLoginBody } from '@sports-booking/types'

import { showApiErrorToast } from '@/lib/api'
import { mpPost } from '@/lib/marketplace-api'
import { setPlayerSession, clearPlayerSession } from '@/lib/player-auth'
import { usePlayerAuthStore, type PlayerCustomer } from '@/store/player-auth.store'

interface PlayerAuthResponse {
  access_token: string
  refresh_token: string
  customer: PlayerCustomer
}

export function usePlayerAuth() {
  const router = useRouter()
  const setStoreSession = usePlayerAuthStore((state) => state.setSession)
  const clearStore = usePlayerAuthStore((state) => state.clear)

  const register = useMutation({
    mutationFn: (body: CustomerRegisterBody) => mpPost<PlayerAuthResponse>('/marketplace/customers/register', body),
    onSuccess: ({ data }) => {
      setPlayerSession({ access_token: data.access_token })
      setStoreSession({ customer: data.customer })
    },
    onError: showApiErrorToast,
  })

  const login = useMutation({
    mutationFn: (body: CustomerLoginBody) => mpPost<PlayerAuthResponse>('/marketplace/customers/login', body),
    onSuccess: ({ data }) => {
      setPlayerSession({ access_token: data.access_token })
      setStoreSession({ customer: data.customer })
    },
    onError: showApiErrorToast,
  })

  const logout = () => {
    clearPlayerSession()
    clearStore()
    router.push('/venues')
  }

  return { register, login, logout }
}
