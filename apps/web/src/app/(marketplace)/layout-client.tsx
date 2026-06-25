'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SPORT_TYPES } from '@sports-booking/types'
import { Building2, LogOut, Search } from 'lucide-react'

import { usePlayerAuthStore } from '@/store/player-auth.store'
import { usePlayerAuth } from '@/hooks/usePlayerAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const SPORT_LABELS: Record<string, string> = {
  futsal: 'Futsal',
  badminton: 'Badminton',
  cricket: 'Cricket',
  playhouse: 'Playhouse',
  other: 'Other',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '')
  return initials.join('') || '?'
}

function VenueSearchForm() {
  const router = useRouter()
  const [sportType, setSportType] = useState('all')
  const [city, setCity] = useState('')

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (sportType !== 'all') params.set('sport_type', sportType)
    if (city.trim()) params.set('city', city.trim())
    const qs = params.toString()
    router.push(qs ? `/venues?${qs}` : '/venues')
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xl items-center gap-2">
      <Select value={sportType} onValueChange={setSportType}>
        <SelectTrigger className="w-40 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any sport</SelectItem>
          {SPORT_TYPES.map((sport) => (
            <SelectItem key={sport} value={sport}>
              {SPORT_LABELS[sport] ?? sport}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" size="icon" variant="secondary" aria-label="Search venues">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  )
}

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const customer = usePlayerAuthStore((state) => state.customer)
  const isAuthenticated = usePlayerAuthStore((state) => state.isAuthenticated)
  const { logout } = usePlayerAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-4">
          <Link href="/venues" className="flex shrink-0 items-center gap-2 font-semibold">
            <Building2 className="h-6 w-6 text-primary" />
            <span>Indoor Sports Booking</span>
          </Link>

          <div className="order-3 w-full md:order-2 md:w-auto md:flex-1">
            <VenueSearchForm />
          </div>

          <nav className="order-2 flex items-center gap-2 md:order-3">
            <Button variant="ghost" asChild>
              <Link href="/register">List Your Venue</Link>
            </Button>
            {isAuthenticated ? (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/my-bookings">My Bookings</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(customer?.full_name ?? '?')}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="font-medium">{customer?.full_name}</span>
                        <span className="text-xs font-normal text-muted-foreground">{customer?.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button asChild>
                <Link href="/player/login">Sign In</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Indoor Sports Booking. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
