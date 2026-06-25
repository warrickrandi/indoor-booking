'use client'

import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { createQueryClient } from '@/lib/query-client'
import { Toaster } from '@/components/ui/sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
