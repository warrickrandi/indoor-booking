import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowRight, CalendarCheck, CreditCard, Search, ShieldCheck, Zap } from 'lucide-react'

import { fetchPublic } from '@/lib/server-api'
import { BRAND_NAME } from '@/lib/brand'
import { SPORTS } from '@/lib/sports'
import { SiteShell } from '@/components/marketplace/SiteShell'
import { HeroSearch } from '@/components/marketplace/HeroSearch'
import { VenueCard, type VenueCardData } from '@/components/marketplace/VenueCard'

const STEPS = [
  {
    icon: Search,
    title: 'Find your venue',
    body: 'Filter by sport and city to see venues near you, with the courts and prices up front.',
  },
  {
    icon: CalendarCheck,
    title: 'Pick a time slot',
    body: 'See live availability and grab the slot you want. We hold it for you while you check out.',
  },
  {
    icon: CreditCard,
    title: 'Pay and play',
    body: 'Pay online, by bank transfer, or at the venue. Show up and play.',
  },
]

const PERKS = [
  { icon: Zap, label: 'Live availability' },
  { icon: ShieldCheck, label: 'Slot held while you pay' },
  { icon: CreditCard, label: 'Online, transfer or pay at venue' },
]

async function loadFeaturedVenues(): Promise<VenueCardData[]> {
  try {
    const result = await fetchPublic<VenueCardData[]>('/marketplace/venues?page=1&limit=6')
    return result.data
  } catch {
    // API asleep or unreachable — the landing page still renders without the venue strip.
    return []
  }
}

export default async function HomePage() {
  const cookieStore = await cookies()
  if (cookieStore.has('sb_session')) {
    redirect('/overview')
  }

  const venues = await loadFeaturedVenues()

  return (
    <SiteShell>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="court-lines absolute inset-0 -z-10 opacity-70" />
        <div className="absolute -left-24 top-10 -z-10 h-80 w-80 rounded-full bg-volt/25 blur-3xl motion-safe:animate-float" />
        <div className="absolute -right-24 bottom-0 -z-10 h-96 w-96 rounded-full bg-emerald-500/30 blur-3xl" />

        <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:pt-24">
          <div className="max-w-3xl motion-safe:animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-volt">
              <span className="h-1.5 w-1.5 rounded-full bg-volt" />
              Indoor sports, booked in seconds
            </span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] sm:text-7xl">
              Book your game.
              <br />
              <span className="text-volt">Own the court.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              Futsal, badminton, cricket and playhouses across Sri Lanka. See what is free, pick a slot and book it, with no phone calls and no waiting for a reply.
            </p>
          </div>

          <div className="mt-10 max-w-4xl motion-safe:animate-fade-up [animation-delay:150ms]">
            <HeroSearch />
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/70">
            {PERKS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-volt" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sports */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">Pick your game</h2>
            <p className="mt-2 text-muted-foreground">Jump straight to venues for your sport.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SPORTS.map(({ key, label, blurb, icon: Icon, gradient }) => (
            <Link
              key={key}
              href={`/venues?sport_type=${key}`}
              className={`group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-5 text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
            >
              <div className="court-lines absolute inset-0 -z-10 opacity-60" />
              <Icon
                aria-hidden
                strokeWidth={1.25}
                className="absolute -right-6 -top-6 h-44 w-44 rotate-12 text-white/25 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110"
              />
              <h3 className="font-display text-2xl font-bold">{label}</h3>
              <p className="mt-1 text-sm text-white/85">{blurb}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                Browse
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured venues */}
      <section className="bg-muted/50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">Popular venues</h2>
              <p className="mt-2 text-muted-foreground">Book a court at one of our partner venues.</p>
            </div>
            {venues.length > 0 && (
              <Link href="/venues" className="hidden items-center gap-1.5 text-sm font-semibold text-primary hover:underline sm:inline-flex">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {venues.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((venue) => (
                <VenueCard key={venue.slug} venue={venue} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed bg-background px-6 py-14 text-center">
              <h3 className="text-xl font-bold">Venues are joining soon</h3>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                We are onboarding the first venues now. Run one yourself? List it and start taking bookings.
              </p>
              <Link
                href="/register"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink-soft"
              >
                List your venue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-12 max-w-xl">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Three steps to game time</h2>
          <p className="mt-2 text-muted-foreground">From search to confirmed booking in about a minute.</p>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="relative rounded-3xl border bg-card p-7 shadow-sm">
              <span className="absolute right-6 top-5 font-display text-6xl font-extrabold text-muted">{index + 1}</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-volt">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-6 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Owner CTA */}
      <section className="px-4 pb-20">
        <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-ink px-6 py-16 text-center text-white sm:px-12">
          <div className="court-lines absolute inset-0 -z-10 opacity-70" />
          <div className="absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-volt/25 blur-3xl" />
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold sm:text-5xl">
            Run a venue? <span className="text-volt">Fill your empty slots.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Manage courts, pricing and bookings in one place, and get found by players on {BRAND_NAME}. Start with a 14-day free trial.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-volt px-7 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-volt-dark"
            >
              List your venue
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
