import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { LayoutClient } from './layout-client'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  if (!cookieStore.has('sb_admin_session')) {
    redirect('/admin/login')
  }

  return <LayoutClient>{children}</LayoutClient>
}
