import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { decodeJwt } from '@/lib/auth'

export interface AuthUser {
  id: string
  full_name: string
  email: string
  phone: string | null
}

export interface AuthCompanyPlan {
  name: string
  tier: 'basic' | 'pro' | 'elite'
}

export interface AuthCompany {
  id: string
  name: string
  slug: string
  status: string
  plan: AuthCompanyPlan
}

export interface AuthActor {
  company_id: string
  role_key: string
  tier: 'basic' | 'pro' | 'elite'
  location_ids: string[]
  permissions: string[]
}

interface AuthState {
  user: AuthUser | null
  company: AuthCompany | null
  actor: AuthActor | null
  isAuthenticated: boolean
  setSession: (params: { user: AuthUser; company: AuthCompany; access_token: string }) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      actor: null,
      isAuthenticated: false,
      setSession: ({ user, company, access_token }) => {
        const decoded = decodeJwt(access_token)
        set({
          user,
          company,
          actor: decoded
            ? {
                company_id: decoded.company_id,
                role_key: decoded.role_key,
                tier: decoded.tier,
                location_ids: decoded.location_ids,
                permissions: decoded.permissions,
              }
            : null,
          isAuthenticated: true,
        })
      },
      clear: () => set({ user: null, company: null, actor: null, isAuthenticated: false }),
    }),
    { name: 'sb-auth-storage' },
  ),
)
