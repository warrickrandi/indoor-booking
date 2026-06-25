import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { LayoutClient } from './layout-client'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  if (!cookieStore.has('sb_session')) {
    redirect('/login')
  }

  return <LayoutClient>{children}</LayoutClient>
}
