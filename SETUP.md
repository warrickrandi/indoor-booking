# Indoor Booking Platform — Setup Guide

Full local development setup for the monorepo from zero.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 | `node --version` |
| pnpm | 9.15.0 | `npm install -g pnpm@9.15.0` |
| PostgreSQL | 16 | via Docker (see below) or local install |
| Redis | 7 | via Docker (see below) or local install |
| Docker Desktop | any | optional — needed for the compose stack |

---

## 1. Clone & Install

```bash
# Clone (or open the existing directory)
cd "c:\Randika\Projects\Indoor Booking\indoor-booking"

# Install all workspace dependencies
pnpm install
```

---

## 2. Start Infrastructure (Postgres + Redis)

### Option A — Docker (recommended)

```bash
docker compose up -d
```

This starts:
- `indoor_booking_postgres` — PostgreSQL 16 on port **5432**
- `indoor_booking_redis` — Redis 7 on port **6379**

Both have healthchecks. Wait for `docker compose ps` to show `healthy` before running migrations.

### Option B — Local Windows install (if Docker / WSL2 unavailable)

1. Download and install [PostgreSQL 16 for Windows](https://www.postgresql.org/download/windows/).
2. During setup, set password to `password` and keep port `5432`.
3. Create the database: open pgAdmin or `psql -U postgres` and run:
   ```sql
   CREATE DATABASE indoor_booking;
   ```
4. Install Redis via the [Memurai](https://www.memurai.com/) Windows port or enable WSL2 and run Redis there.

---

## 3. Environment Variables

### How env files work in this monorepo

```
.env                   ← The only file you fill in for local dev (all apps load this)
.env.example           ← Template showing every var (committed to git, not used at runtime)
.env.docker            ← Reference values for docker-compose Postgres/Redis
apps/api/.env.example  ← Deployment docs: what to set in Railway for the API
apps/web/.env.example  ← Deployment docs: what to set in Vercel for the web app
apps/web/.env.local    ← Already filled in (Next.js reads this automatically in dev)
apps/worker/.env.example ← Deployment docs: what to set in Railway for the worker
```

The per-app `.env.example` files are **not** files you fill in — they document which vars each service needs when deployed independently. For local dev you only ever touch the **root `.env`**.

### Create the root `.env`

Copy the example and fill in your values:

```powershell
Copy-Item .env.example .env
```

Or create it from scratch — all required vars:

```env
# ── Database & Cache ────────────────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/indoor_booking"
REDIS_URL="redis://localhost:6379"

# ── JWT Secrets (min 32 chars each) ─────────────────────────────────────────
VENUE_JWT_SECRET="change-me-venue-secret-at-least-32-chars"
PLAYER_JWT_SECRET="change-me-player-secret-at-least-32-chars"
PLATFORM_JWT_SECRET="change-me-platform-secret-at-least-32-chars"

# ── Encryption (AES-256) — must be exactly 64 hex characters ────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000001"

# ── PayHere Payment Gateway (platform master credentials) ───────────────────
PAYHERE_MERCHANT_ID="your_payhere_merchant_id"
PAYHERE_SECRET="your_payhere_merchant_secret"

# ── SMTP (Postal or any SMTP server) ────────────────────────────────────────
SMTP_HOST="smtp.yourserver.com"
SMTP_PORT=587
SMTP_FROM="noreply@yourplatform.com"

# ── Cloudflare R2 File Storage (S3-compatible) ──────────────────────────────
STORAGE_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
STORAGE_ACCESS_KEY="your_r2_access_key"
STORAGE_SECRET_KEY="your_r2_secret_key"
STORAGE_BUCKET="indoor-booking"

# ── URLs ─────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
API_URL="http://localhost:3001/api/v1"
FRONTEND_URL="http://localhost:3000"

# ── Domain & SSL (custom domain feature) ────────────────────────────────────
PLATFORM_DOMAIN="yourdomain.com"
# VERCEL_TOKEN=                  # only needed for custom domain provisioning
# VERCEL_PROJECT_ID=             # only needed for custom domain provisioning

# ── App settings ─────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001
HOST=0.0.0.0
ALLOWED_ORIGINS="http://localhost:3000"
```

> **Minimum viable dev setup**: all vars above are required by the API startup Zod schema — it will refuse to start with a missing var. `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` are the only optional ones.

---

## 4. Generate Prisma Client

On **Windows**, stop the API dev server (if running) before this step — the Prisma generator locks a `.node` binary that the running process holds open.

```powershell
pnpm db:generate
```

This runs `prisma generate` against `packages/db/prisma/schema.prisma` and outputs the typed client to `packages/db/generated/`.

---

## 5. Run Database Migrations

Applies all migrations in `packages/db/prisma/migrations/` in order.

```powershell
pnpm db:migrate
```

For CI or production (no interactive prompts):

```powershell
pnpm --filter @sports-booking/db exec dotenv -e ../../.env -- prisma migrate deploy
```

> If you need to create a new migration see [Adding Migrations](#adding-migrations) below.

---

## 6. Seed the Database

Populates:
- Platform admin account (`platformadmin@test.com` / `Test1234!`)
- Permission keys (RBAC)
- Subscription plans (basic, pro, elite)
- Payment gateway driver rows (payhere active, webxpay/directpay inactive stubs)

```powershell
pnpm db:seed
```

---

## 7. Start All Apps (Development)

Open **three terminals**:

### Terminal 1 — API (Fastify, port 3001)

```powershell
pnpm --filter @sports-booking/api dev
```

### Terminal 2 — Web (Next.js, port 3000)

```powershell
pnpm --filter @sports-booking/web dev
```

### Terminal 3 — Worker (BullMQ)

```powershell
pnpm --filter @sports-booking/worker dev
```

Or run all three at once with Turborepo (streams logs from all):

```powershell
pnpm dev
```

---

## 8. Verify the Setup

```powershell
# Health check
Invoke-RestMethod http://localhost:3001/api/v1/health

# Expected response:
# { data: { status: 'ok', db: 'ok', redis: 'ok' } }
```

Open [http://localhost:3000](http://localhost:3000) — the marketing landing page should load.
Open [http://localhost:3000/login](http://localhost:3000/login) — venue owner login.

---

## 9. Build for Production

```powershell
# Type-check all packages
pnpm type-check

# Build all packages and apps
pnpm build
```

Outputs:
- `apps/api/dist/` — compiled Fastify server
- `apps/web/.next/` — Next.js production build
- `apps/worker/dist/` — compiled BullMQ worker

---

## Project Structure

```
indoor-booking/
├── apps/
│   ├── api/           Fastify REST API — all business logic
│   │   ├── src/
│   │   │   ├── app.ts          Fastify instance + plugin registration
│   │   │   ├── server.ts       Entry point — binds port, starts cron jobs
│   │   │   ├── routes/         One file per domain (auth, bookings, payments…)
│   │   │   ├── services/       Business logic — routes call services only
│   │   │   ├── middleware/     auth.ts + rbac.ts
│   │   │   ├── jobs/           BullMQ job definitions (enqueued here)
│   │   │   └── lib/            redis, prisma, encrypt, jwt, env, errors…
│   │   └── scripts/            One-off scripts (load-test-slots.ts)
│   │
│   ├── web/           Next.js 15 — venue owner dashboard + player marketplace
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (dashboard)/   Venue owner portal (auth-gated)
│   │       │   ├── (marketplace)/ Player booking site
│   │       │   ├── (marketing)/   Public landing + pricing
│   │       │   └── admin/         Platform admin UI
│   │       ├── hooks/             TanStack Query hooks per domain
│   │       ├── lib/               api.ts, auth.ts, utils…
│   │       └── components/        shadcn/ui primitives + custom components
│   │
│   └── worker/        BullMQ job processor — emails, reminders, slot cleanup
│       └── src/
│           ├── index.ts         Worker entry + graceful shutdown
│           ├── jobs/            Worker definitions (email, reminder, slot-cleanup…)
│           └── services/        email.service.ts (SMTP + DKIM), etc.
│
├── packages/
│   ├── db/            Prisma schema + generated client (shared by api + worker)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── seed.ts
│   │       └── migrations/
│   ├── types/         Shared TypeScript types and Zod request schemas
│   └── email/         React Email templates
│
├── scripts/           PowerShell smoke-test scripts
│   ├── smoke-test-e2e.ps1
│   ├── smoke-test-billing.ps1
│   ├── smoke-test-admin-reports.ps1
│   ├── smoke-test-domains.ps1
│   └── smoke-test-gateways-dkim.ps1
│
├── docker-compose.yml  Postgres 16 + Redis 7
├── turbo.json
├── pnpm-workspace.yaml
├── CLAUDE.md           AI context for this codebase
└── .env                Your local environment variables (not committed)
```

---

## Key Concepts

### Multi-tenancy
Every database table is scoped by `company_id`. Venue staff can never read data outside their company. Location managers are further scoped to `location_ids` baked into their JWT.

### Auth — Three JWT Types
| Token type | Secret env var | Expiry | Used by |
|---|---|---|---|
| `venue_staff` | `VENUE_JWT_SECRET` | 15 min | Venue owner / staff dashboard |
| `player` | `PLAYER_JWT_SECRET` | 24 hr | Player marketplace |
| `platform_admin` | `PLATFORM_JWT_SECRET` | 15 min | Platform super-admin |

### Subscription Tiers
| Tier | Locations | Features |
|---|---|---|
| basic | 1 | Marketplace profile, admin + receptionist roles |
| pro | multi | Branded subdomain, location_manager role |
| elite | unlimited | Custom domain, full RBAC, custom SMTP + DKIM |

### Slot Locking (double-booking prevention)
1. `Redis SET NX EX 600` — atomic lock with 10-min TTL
2. `SELECT ... FOR UPDATE` inside a Postgres transaction
3. `time_slots.lock_token` + `locked_until` persisted for visibility

---

## Common Development Tasks

### Prisma Studio (database GUI)

```powershell
pnpm db:studio
```

Opens at [http://localhost:5555](http://localhost:5555).

### Adding Migrations

When you change `schema.prisma` on Windows, use the non-interactive path to avoid EPERM errors:

```powershell
# 1. Stop the API dev server first

# 2. Create migration folder manually
$ts = Get-Date -Format "yyyyMMddHHmmss"
New-Item -ItemType Directory "packages\db\prisma\migrations\${ts}_your_description"

# 3. Write the SQL manually into migration.sql

# 4. Deploy (no interactive prompt)
pnpm --filter @sports-booking/db exec dotenv -e ../../.env -- prisma migrate deploy

# 5. Regenerate the client
pnpm db:generate
```

### Running Smoke Tests

Requires a running API, seeded DB, and the platform admin account (`platformadmin@test.com` / `Test1234!`).

```powershell
# End-to-end booking flow
.\scripts\smoke-test-e2e.ps1

# Billing + subscription upgrade flow
.\scripts\smoke-test-billing.ps1

# Payment gateway config + DKIM key generation
.\scripts\smoke-test-gateways-dkim.ps1

# Custom domain provisioning
.\scripts\smoke-test-domains.ps1

# Admin reports + CSV export
.\scripts\smoke-test-admin-reports.ps1
```

### Load Testing Slot Locking

```powershell
# 10 concurrent requests (default)
npx tsx apps/api/scripts/load-test-slots.ts <slotId>

# 50 concurrent requests
npx tsx apps/api/scripts/load-test-slots.ts <slotId> 50
```

Exit code 1 + "DOUBLE BOOKING VULNERABILITY DETECTED" means the lock failed.

---

## Deployment

### API — Railway

- `apps/api/Procfile`: `web: node dist/server.js`
- `apps/api/railway.json`: build command `pnpm build`, start command from Procfile
- Set all env vars in the Railway project settings
- `prisma migrate deploy` runs as a release command before start

### Web — Vercel

- Set `NEXT_PUBLIC_API_URL` to the Railway API URL
- Root directory: `apps/web`
- Framework preset: Next.js

### Worker — Railway (separate service)

- `apps/worker/Procfile`: `worker: node dist/index.js`
- Must share the same `DATABASE_URL` and `REDIS_URL` as the API

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `EPERM` on `prisma generate` | Stop the API dev server before running `pnpm db:generate` |
| `P1001` — connection refused to Postgres | Start Docker (`docker compose up -d`) or check local Postgres is running |
| JWT verification fails across apps | Confirm all three `*_JWT_SECRET` vars match between API and any tool making requests |
| Worker not processing jobs | Confirm `REDIS_URL` is the same for both API and worker; check worker terminal for errors |
| `ENCRYPTION_KEY must be exactly 64 hex chars` | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| Slot lock not releasing | Slots auto-unlock after 10 min (Redis TTL); or `DEL slot:lock:<slotId>` in redis-cli |
| `migrate dev` hangs on Windows | Use `migrate deploy` instead (see [Adding Migrations](#adding-migrations)) |
