'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MapPin,
  CalendarCheck,
  CalendarClock,
  Users,
  CreditCard,
  Mail,
  Settings,
  Menu,
  X,
  LogOut,
  Building2,
  BarChart3,
  Globe,
  Receipt,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavItem {
  label: string
  href: string
  icon: typeof LayoutDashboard
  permission: string | null
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/overview', icon: LayoutDashboard, permission: null },
  { label: 'Locations', href: '/locations', icon: MapPin, permission: 'locations.read' },
  { label: 'Bookings', href: '/bookings', icon: CalendarCheck, permission: 'bookings.read' },
  { label: 'Reports', href: '/reports', icon: BarChart3, permission: 'reports.daily' },
  { label: 'Slots', href: '/slots', icon: CalendarClock, permission: 'slots.read' },
  { label: 'Staff', href: '/settings/staff', icon: Users, permission: 'staff.invite' },
  { label: 'Payments', href: '/settings/gateway', icon: CreditCard, permission: 'payments.gateway_config' },
  { label: 'Email', href: '/settings/email', icon: Mail, permission: 'company.branding' },
  { label: 'Domains', href: '/settings/domains', icon: Globe, permission: 'company.branding' },
  { label: 'Billing', href: '/settings/billing', icon: Receipt, permission: 'company.branding' },
  { label: 'Settings', href: '/settings/branding', icon: Settings, permission: 'company.branding' },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '')
  return initials.join('') || '?'
}

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const company = useAuthStore((state) => state.company)
  const actor = useAuthStore((state) => state.actor)
  const { logout } = useAuth()

  const navItems = NAV_ITEMS.filter(
    (item) => item.permission === null || actor?.permissions.includes(item.permission),
  )

  return (
    <div className="flex min-h-screen bg-muted/30">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r bg-background transition-transform md:static md:translate-x-0',
          sidebarOpen && 'translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <Building2 className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate font-semibold">{company?.name ?? 'Indoor Sports Booking'}</span>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-background px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden md:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{getInitials(user?.full_name ?? '?')}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">{user?.full_name ?? 'Account'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user?.full_name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout.mutate()} disabled={logout.isPending}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
