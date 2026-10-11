import type { Metadata } from 'next'

import { Inter, Outfit } from 'next/font/google'

import { Providers } from './providers'
import './globals.css'

const display = Outfit({ subsets: ['latin'], variable: '--font-display', display: 'swap' })
const body    = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' })

export const metadata: Metadata = {
  title: 'Indoor Booking — Book futsal, badminton, cricket & more',
  description: 'Find and book indoor sports venues in Sri Lanka. Live availability, easy payment, no phone calls.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
