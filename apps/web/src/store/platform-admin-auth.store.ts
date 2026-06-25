import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { decodeAdminJwt } from '@/lib/platform-admin-auth'

export interface PlatformAdminUser {
  id: string
  full_name: string
  email: string
}

interface PlatformAdminAuthState {
  admin: (PlatformAdminUser & { platform_role: string }) | null
  isAuthenticated: boolean
  setSession: (params: { user: PlatformAdminUser; access_token: string }) => void
  clear: () => void
}

export const usePlatformAdminAuthStore = create<PlatformAdminAuthState>()(
  persist(
    (set) => ({
      admin: null,
      isAuthenticated: false,
      setSession: ({ user, access_token }) => {
        const decoded = decodeAdminJwt(access_token)
        set({
          admin: { ...user, platform_role: decoded?.platform_role ?? '' },
          isAuthenticated: true,
        })
      },
      clear: () => set({ admin: null, isAuthenticated: false }),
    }),
    { name: 'sb-admin-auth-storage' },
  ),
)
