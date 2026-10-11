'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Goal, LogOut, Menu, X } from 'lucide-react'

import { usePlayerAuthStore } from '@/store/player-auth.store'
import { usePlayerAuth } from '@/hooks/usePlayerAuth'
import { BRAND_NAME } from '@/lib/brand'
import { SPORTS } from '@/lib/sports'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-volt text-ink">
        <Goal className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-white">{BRAND_NAME}</span>
    </Link>
  )
}

const NAV_LINKS = [
  { href: '/venues', label: 'Browse venues' },
  { href: '/pricing', label: 'For venues' },
]

const NAV_LINK_CLASS = 'rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white'

function SiteHeader() {
  const [open, setOpen] = useState(false)
  const customer = usePlayerAuthStore((state) => state.customer)
  const isAuthenticated = usePlayerAuthStore((state) => state.isAuthenticated)
  const { logout } = usePlayerAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={NAV_LINK_CLASS}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <>
              <Link href="/my-bookings" className={NAV_LINK_CLASS}>
                My bookings
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full outline-none ring-offset-2 ring-offset-ink focus-visible:ring-2 focus-visible:ring-volt">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-volt font-semibold text-ink">
                      {getInitials(customer?.full_name ?? '?')}
                    </AvatarFallback>
                  </Avatar>
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
            <>
              <Link href="/player/login" className={NAV_LINK_CLASS}>
                Sign in
              </Link>
              <Link
                href="/player/register"
                className="rounded-full bg-volt px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-volt-dark"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-white md:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-ink px-4 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-white/80"
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link
                  href="/my-bookings"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-white/80"
                >
                  My bookings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    logout()
                  }}
                  className="rounded-lg px-3 py-3 text-left text-base font-medium text-white/80"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link
                  href="/player/login"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-white/20 px-4 py-3 text-center text-sm font-semibold text-white"
                >
                  Sign in
                </Link>
                <Link
                  href="/player/register"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-volt px-4 py-3 text-center text-sm font-semibold text-ink"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

const FOOTER_LINK_CLASS = 'transition-colors hover:text-white'

function SiteFooter() {
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed">
            Find and book indoor sports venues across Sri Lanka. Live availability, easy payment, no phone tag.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Play</h3>
          <ul className="space-y-2.5 text-sm">
            {SPORTS.map((sport) => (
              <li key={sport.key}>
                <Link href={`/venues?sport_type=${sport.key}`} className={FOOTER_LINK_CLASS}>
                  {sport.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">For venue owners</h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/register" className={FOOTER_LINK_CLASS}>List your venue</Link></li>
            <li><Link href="/pricing" className={FOOTER_LINK_CLASS}>Pricing</Link></li>
            <li><Link href="/login" className={FOOTER_LINK_CLASS}>Venue login</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Your account</h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/player/login" className={FOOTER_LINK_CLASS}>Sign in</Link></li>
            <li><Link href="/player/register" className={FOOTER_LINK_CLASS}>Create account</Link></li>
            <li><Link href="/my-bookings" className={FOOTER_LINK_CLASS}>My bookings</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-white/50">
          &copy; {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-sport flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
