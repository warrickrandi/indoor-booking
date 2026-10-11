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
- **Deployment**: API + worker on Render, Redis on Upstash, files on Cloudflare R2, web on Vercel

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

Production runs on free tiers: **Render** (API + worker + PostgreSQL), **Upstash**
(Redis), **Cloudflare R2** (file storage) and **Vercel** (web). Nothing secret is
checked into git; all values are set in each platform's dashboard.

Deploy order: Upstash + R2 → Render (API) → Vercel (web) → back to Render to fix URLs.

### 1. Redis — Upstash

1. Create a Redis database at [upstash.com](https://upstash.com) (pick a region near Render's Singapore).
2. Copy the connection string and use the **TLS** form, `rediss://` (two s's):
   ```
   rediss://default:<password>@<host>.upstash.io:6379
   ```
   Paste only the URL, not the `redis-cli --tls -u ...` command.
3. This is `REDIS_URL` on Render. If the password is ever exposed, reset it in the Upstash dashboard and update Render.

Note: BullMQ polls Redis constantly. The Upstash free tier has a daily command cap
(~10k) and can run out ("max daily request limit exceeded"). Use pay-as-you-go if it does.

### 2. File storage — Cloudflare R2

Used for bank-transfer payment slip uploads (`POST /api/v1/uploads/slip`, stored under
`slips/<company_id>/<booking_id>/...`). Without it the app still runs; only slip uploads fail.

1. Cloudflare dashboard → **R2 object storage**. Activating R2 requires a payment method (free tier: 10 GB, no egress fees).
2. **Create bucket**, e.g. `indoor-booking-slips` → this is `STORAGE_BUCKET`.
3. **Manage R2 API Tokens → Create Account API token**: permission **Object Read & Write**, scoped to that bucket.
4. Copy from the confirmation page (the secret is shown only once):
   - Access Key ID → `STORAGE_ACCESS_KEY`
   - Secret Access Key → `STORAGE_SECRET_KEY`
   - S3 endpoint `https://<account-id>.r2.cloudflarestorage.com` → `STORAGE_ENDPOINT` (no bucket name, no trailing slash)

**The bucket stays private.** It needs no public access, no r2.dev address and no extra variable:
only the API server reads and writes it, using the four `STORAGE_*` values above.

- **Payment slips** are stored under `slips/` and are never served publicly.
- **Venue photos and logos** (venue dashboard -> Media, and Settings -> Branding) are stored under
  `media/<company_id>/` and `logos/<company_id>/`. Browsers load them through the API at
  `<API_URL>/api/v1/media/files/<key>`, which streams the file from the bucket with a one-year cache header.
  Only `media/` and `logos/` keys are served; nothing else in the bucket can be fetched through that route.
- **Videos** are not uploaded: venues paste a YouTube or Vimeo link.

Because images pass through the API, a cold-started free Render instance serves them slowly on the first
request; browsers then cache them. Moving to a CDN or a public bucket later only needs the URL builder in
`apps/api/src/services/media.service.ts` (`fileUrl`) changed.

### 3. API + worker — Render

Defined in [`render.yaml`](render.yaml) (Blueprint): a web service, and a Postgres database.

- **Create**: Render dashboard → **New → Blueprint** → select the repo. Render prompts for every
  variable marked `sync: false`. Push `render.yaml` to GitHub first; Render only reads the pushed copy.
  If the service already exists, add the variables under **Environment** instead (saving redeploys).
- **Build** installs with `--prod=false` (Render sets `NODE_ENV=production`, which would otherwise
  skip `@types/*` and `typescript`) and builds `types`, `email`, `api`, `worker` in that order,
  because workspace packages resolve through `dist/`.
- **Start** runs `prisma migrate deploy`, starts the worker in the background, then the API.
- **Worker on the free plan**: Render has no free background workers, so the worker runs inside the
  web service. Limits: the free instance sleeps after ~15 min idle (jobs pause with it) and a worker
  crash is not restarted. For production, uncomment the `type: worker` block in `render.yaml`
  (paid `starter` plan), remove the background line from the start command, and give it the same
  env vars, including `SMTP_USER` / `SMTP_PASSWORD`.
- **Health check**: `/api/v1/health` (the health route is mounted under the `/api/v1` prefix).

Environment variables to set on Render:

| Variable | Value |
|---|---|
| `NODE_ENV`, `HOST`, `DATABASE_URL` | set automatically by the blueprint |
| `VENUE_JWT_SECRET`, `PLAYER_JWT_SECRET`, `PLATFORM_JWT_SECRET` | generated automatically (min 32 chars) |
| `REDIS_URL` | Upstash `rediss://` URL |
| `ENCRYPTION_KEY` | 64 hex chars: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep a copy: losing it makes stored gateway credentials undecryptable |
| `FRONTEND_URL` | Vercel URL, e.g. `https://yourapp.vercel.app` |
| `ALLOWED_ORIGINS` | Same Vercel URL (comma-separated if several); default is `http://localhost:3000`, which blocks the site |
| `API_URL` | The Render service URL, e.g. `https://indoor-booking-api.onrender.com` |
| `PLATFORM_DOMAIN` | Bare domain, no `https://`, e.g. `yourplatform.com` (see Vercel step) |
| `PAYHERE_MERCHANT_ID`, `PAYHERE_SECRET` | From PayHere (sandbox values are fine for testing) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD` | Postal SMTP. `SMTP_FROM` must be a valid email. `SMTP_USER`/`SMTP_PASSWORD` are required by the worker only |
| `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET` | From R2 (above). Endpoint must be a full URL; placeholders such as `https://example.com` pass the startup check |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` | Optional, only for the custom-domain feature |

The API refuses to start if any required variable is missing. The log lists the missing names.

### 4. Web — Vercel

1. Import the repo into [Vercel](https://vercel.com), root directory `apps/web` (Next.js 15).
2. Set environment variables:
   - `NEXT_PUBLIC_API_URL` = the Render API URL, no trailing slash. Vercel warns that `NEXT_PUBLIC_`
     values are exposed to the browser. That is expected and safe here (the API URL is public, and the
     browser needs it). Do not rename it. Never put real secrets under a `NEXT_PUBLIC_` name.
   - `NEXT_PUBLIC_PLATFORM_DOMAIN` = same value as `PLATFORM_DOMAIN` on Render (hostname only).
     If you have no domain yet, use the Vercel hostname (e.g. `yourapp.vercel.app`); branded
     subdomains for Pro venues will not work until you own a domain.
3. `NEXT_PUBLIC_*` values are baked in at build time, so **redeploy after changing them**.
4. Copy the Vercel URL back into Render's `FRONTEND_URL` and `ALLOWED_ORIGINS` and the Render URL into `API_URL`.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Cannot find module 'node:crypto'`, `'@sports-booking/types'`, or `bcryptjs` types during build | devDependencies skipped or workspace packages not built; use the build command in `render.yaml` |
| `Invalid environment variables ... Required` at start | Add the listed variables under Render → Environment |
| "No open ports detected" | Usually the API crashed before listening; read the log above it |
| Browser CORS errors | `ALLOWED_ORIGINS` / `FRONTEND_URL` do not match the Vercel URL exactly |
| `max daily request limit exceeded` | Upstash free-tier command cap; upgrade or switch Redis |
| First request after idle is slow | Free Render instance wakes from sleep |
| Free Render Postgres | Expires after a limited period; back up or upgrade before relying on it |

### Railway (legacy)

`apps/api/railway.json`, `apps/worker/railway.json` and the `Procfile`s remain for a Railway
deployment; run `npx tsx apps/api/scripts/migrate-prod.ts` before each deploy there.

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
