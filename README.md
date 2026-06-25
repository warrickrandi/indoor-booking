# Indoor Sports Booking Platform

A white-label, multi-tenant SaaS platform for indoor sports venue booking
(futsal, badminton, cricket, playhouses) in Sri Lanka. Venue owners manage
their locations, courts, pricing and bookings through a dashboard, while
players discover and book slots through a public marketplace.

## Tech stack

- **Package manager**: pnpm workspaces
- **Build system**: Turborepo
- **API**: Fastify 5 + TypeScript (`apps/api`)
- **Web**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (`apps/web`)
- **Worker**: BullMQ job processor for emails, slot generation, reminders and cleanup (`apps/worker`)
- **ORM**: Prisma + PostgreSQL (`packages/db`)
- **Cache / queues**: Redis (ioredis + BullMQ)
- **Auth**: JWT, three separate token types (venue staff, player, platform admin)
- **Payments**: PayHere gateway (Sri Lanka), pluggable adapter pattern
- **Email**: React Email templates (`packages/email`), sent via a self-hosted Postal SMTP server
- **File storage**: Cloudflare R2 (S3-compatible)
- **Deployment**: API + worker on Railway, web on Vercel

## Monorepo structure

```
sports-booking/
├── apps/
│   ├── api/       Fastify REST API — all business logic lives here
│   ├── web/       Next.js 15 — venue owner dashboard + player marketplace + platform admin
│   └── worker/    BullMQ job processor — emails, slot generation, notifications, cleanup
├── packages/
│   ├── db/        Prisma schema + generated client (shared by api + worker)
│   ├── types/     Shared TypeScript types and Zod schemas
│   └── email/     React Email templates
├── scripts/       Cross-app PowerShell smoke tests
├── turbo.json
└── pnpm-workspace.yaml
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [pnpm](https://pnpm.io/) 9 or later (`npm install -g pnpm`)
- [Docker](https://www.docker.com/) (for local PostgreSQL + Redis via `docker-compose.yml`)

## Local setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment variables (see "Environment variables" below)
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local

# 3. Start PostgreSQL + Redis
docker compose up -d

# 4. Generate the Prisma client, apply migrations, and seed reference data
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

`apps/api` and `apps/worker` both load the root `.env` automatically (with an
optional per-app `.env` override) — see `apps/api/.env.example` and
`apps/worker/.env.example` if you want to set app-specific values instead.

## Running the project

```bash
pnpm dev
```

This runs `turbo run dev`, starting all three apps in parallel:

- API → http://localhost:3001 (health check: `GET /api/v1/health`)
- Web → http://localhost:3000
- Worker → background BullMQ processor (no HTTP port)

Other useful root scripts:

```bash
pnpm build        # turbo run build — builds all apps
pnpm lint         # turbo run lint
pnpm type-check   # turbo run type-check
pnpm db:studio    # Prisma Studio against DATABASE_URL
```

## Running tests / smoke tests

There is no unit test suite yet — correctness is verified via type-checking,
build, a data-integrity sweep, and end-to-end PowerShell smoke scripts run
against a live local stack (`docker compose up -d` + `pnpm dev`).

```bash
# Static verification
pnpm type-check
pnpm build

# Data-integrity sweep — flags bookings/slots/payments that drifted out of sync
npx tsx apps/api/scripts/verify-state-machine.ts

# End-to-end smoke test (register → book → check-in → reports)
pwsh ./scripts/smoke-test-e2e.ps1

# Platform admin + reporting smoke test
pwsh ./scripts/smoke-test-admin-reports.ps1
```

The admin/reports script requires a platform admin user — see the comment
block at the top of `scripts/smoke-test-admin-reports.ps1` for the one-time
manual setup SQL.

## Environment variables

Each app validates its required environment variables with Zod at startup
and refuses to start if any are missing. Copy the relevant example file(s)
and fill in real values:

- [`.env.example`](.env.example) — root, shared by `apps/api`, `apps/worker` and `packages/db` (database, Redis, JWT secrets, encryption key, PayHere, SMTP, storage)
- [`apps/api/.env.example`](apps/api/.env.example) — API-specific overrides (port, host, allowed origins)
- [`apps/worker/.env.example`](apps/worker/.env.example) — worker-specific overrides
- [`apps/web/.env.example`](apps/web/.env.example) — `NEXT_PUBLIC_API_URL`
- [`.env.docker`](.env.docker) — reference values matching the local `docker-compose.yml` services

## Deployment

- **API** (`apps/api`) and **worker** (`apps/worker`) deploy to [Railway](https://railway.app),
  each with its own `railway.json` (Nixpacks build, `pnpm --filter ... build`) and `Procfile`.
  Before each deploy, run `npx tsx apps/api/scripts/migrate-prod.ts` to apply
  pending Prisma migrations (`prisma migrate deploy`).
- **Web** (`apps/web`) deploys to [Vercel](https://vercel.com) as a standard
  Next.js 15 app — set `NEXT_PUBLIC_API_URL` to the deployed API URL.
- All required environment variables (see above) must be configured in each
  platform's project settings — nothing is hard-coded or checked into git.

## Session log

- **Session 1** — Scaffolded the full Turborepo monorepo: root config, Prisma
  schema (34 tables), Fastify API skeleton (env/prisma/redis/errors/encrypt,
  auth + RBAC middleware), worker stub, Next.js web scaffold, seed data.
- **Session 2** — Reconciled local dev database setup.
- **Session 3** — Company profile/branding/members/subscription endpoints,
  location CRUD + operating hours + holidays, sub-venue + pricing-rule CRUD.
- **Session 4** — Time slot generation, availability/calendar endpoints, Redis
  slot locking (`SET NX EX 600` + `SELECT ... FOR UPDATE`), repeating
  slot-cleanup job.
- **Session 5** — Bookings and all three payment flows (pay at venue, bank
  transfer slip upload/verification, PayHere online checkout + webhook),
  cancellations, transaction listing.
- **Session 6** — Venue owner dashboard UI in `apps/web`: shadcn/ui
  foundation, auth, locations/sub-venues/pricing/slot calendar, bookings,
  settings (branding/staff/gateway).
- **Session 7** — Player-facing marketplace UI: venue listing/detail, slot
  booking wizard (lock → details/payment → confirm), booking history, player
  auth.
- **Session 8** — Email system: Postal SMTP integration, 10 React Email
  templates, BullMQ email worker with retry backoff, daily booking reminders,
  per-company email configuration UI.
- **Session 9** — Platform admin panel (`/api/v1/admin/*`, `(admin)` web route
  group) for cross-tenant stats, company management, subscription plans,
  audit logs and gateway drivers; venue-facing reporting API and UI
  (`/api/v1/reports/*`, daily summary / revenue / occupancy / CSV export).
- **Session 10** — End-to-end verification and deployment hardening: security
  audit (headers, CORS, rate limiting, RBAC, webhook verification), data
  integrity sweep script, abandoned-payment cleanup job, Prisma index review,
  N+1 query review, `.env.example` files for every app, Railway/Vercel
  deployment config (`Procfile`, `railway.json`, `migrate-prod.ts`), Docker
  Compose healthchecks, and this README.
