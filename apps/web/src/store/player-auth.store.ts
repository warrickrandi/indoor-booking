import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PlayerCustomer {
  id: string
  full_name: string
  email: string | null
  phone: string | null
}

interface PlayerAuthState {
  customer: PlayerCustomer | null
  isAuthenticated: boolean
  setSession: (params: { customer: PlayerCustomer }) => void
  clear: () => void
}

export const usePlayerAuthStore = create<PlayerAuthState>()(
  persist(
    (set) => ({
      customer: null,
      isAuthenticated: false,
      setSession: ({ customer }) => set({ customer, isAuthenticated: true }),
      clear: () => set({ customer: null, isAuthenticated: false }),
    }),
    { name: 'sb-player-auth-storage' },
  ),
)
