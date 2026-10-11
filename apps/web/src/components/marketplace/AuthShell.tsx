import { CalendarCheck, CreditCard, LayoutDashboard, TrendingUp, Users, Zap } from 'lucide-react'

import { BRAND_NAME } from '@/lib/brand'

const PLAYER_COPY = {
  headline: ['Book your game.', 'Own the court.'],
  body: `Join players booking futsal, badminton, cricket and more on ${BRAND_NAME}.`,
  points: [
    { icon: Zap, text: 'See live availability across venues' },
    { icon: CalendarCheck, text: 'Hold your slot while you check out' },
    { icon: CreditCard, text: 'Pay online, by transfer or at the venue' },
  ],
}

const OWNER_COPY = {
  headline: ['Run your venue.', 'Fill every slot.'],
  body: `Courts, pricing and bookings in one dashboard, and a listing on ${BRAND_NAME} so players can find you.`,
  points: [
    { icon: LayoutDashboard, text: 'Manage courts, slots and prices in one place' },
    { icon: Users, text: 'Get discovered by players searching near them' },
    { icon: TrendingUp, text: 'Track bookings and revenue with live reports' },
  ],
}

interface AuthShellProps {
  /** Which audience the side panel speaks to. */
  variant?: 'player' | 'owner'
  /** Form column width; use 'lg' for longer forms. */
  width?: 'md' | 'lg'
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}

/** Split-screen layout for the player sign-in / sign-up pages. */
export function AuthShell({ variant = 'player', width = 'md', title, subtitle, children, footer }: AuthShellProps) {
  const copy = variant === 'owner' ? OWNER_COPY : PLAYER_COPY

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <aside className="relative isolate hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="court-lines absolute inset-0 -z-10 opacity-70" />
        <div className="absolute -left-16 top-16 -z-10 h-72 w-72 rounded-full bg-volt/25 blur-3xl" />
        <div className="absolute -bottom-16 right-0 -z-10 h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl" />
        <h2 className="max-w-md text-5xl font-extrabold leading-tight">
          {copy.headline[0]}
          <br />
          <span className="text-volt">{copy.headline[1]}</span>
        </h2>
        <p className="mt-4 max-w-md text-white/70">{copy.body}</p>
        <ul className="mt-10 space-y-4">
          {copy.points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-white/85">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-volt">
                <Icon className="h-5 w-5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex items-center justify-center px-4 py-12">
        <div className={width === 'lg' ? 'w-full max-w-xl' : 'w-full max-w-md'}>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-2 mb-8 text-muted-foreground">{subtitle}</p>
          {children}
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    </div>
  )
}
