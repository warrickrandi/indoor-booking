# Web app — Next.js context

See root CLAUDE.md for full platform context.

## This app's job
Two distinct UIs in one Next.js app using route groups:
1. (marketing) — public landing page and pricing
2. (dashboard) — venue owner portal (auth-gated, server components + client)
3. (marketplace) — player-facing booking site (public + auth for bookings)

## Route groups and their auth
- (marketing): no auth required
- (dashboard): layout.tsx checks venue_staff JWT — redirect to /login if missing
- (marketplace): mostly public; booking flow requires player JWT

## State management
- Server state: React Query (TanStack Query) for all API calls
- UI state: Zustand for global UI (sidebar, modals)
- Forms: React Hook Form + Zod resolver
- Never fetch data in client components on page load — use server components
  to fetch initial data and pass as props

## API calls from web
All API calls go through src/lib/api.ts which:
- Sets base URL from NEXT_PUBLIC_API_URL
- Attaches Authorization: Bearer {token} from localStorage/cookie
- Handles 401 by attempting token refresh then retrying once
- Throws typed errors that React Query can catch

## Component conventions
- UI primitives from shadcn/ui (already installed)
- Page components are server components by default
- Interactive components get 'use client' directive
- Forms always use React Hook Form — never raw useState for form fields
- Booking calendar grid is a custom client component (not a library)

## Theming for white-label
CSS variables injected at the layout level for (marketplace) route group.
Venue branding (primary_color, logo_url) fetched server-side from API
using the Host header and applied as CSS custom properties.
Dashboard always uses platform branding (no white-label in owner portal).