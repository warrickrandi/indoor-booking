# Indoor Sports Booking Platform — Claude Code Context

## What this project is
A white-label multi-tenant SaaS platform for indoor sports venue booking
(futsal, badminton, cricket, playhouses) built in Sri Lanka. Venue owners
register, set up their account, and take bookings. Players browse and book
slots via a marketplace. Payment gateway is PayHere (Sri Lanka).

## Monorepo structure
```
sports-booking/
├── apps/
│   ├── api/       Fastify REST API — all business logic lives here
│   ├── web/       Next.js 15 — venue owner dashboard + player marketplace
│   └── worker/    BullMQ job processor — emails, slot generation, notifications
├── packages/
│   ├── db/        Prisma schema + generated client (shared by api + worker)
│   ├── types/     Shared TypeScript types and Zod schemas
│   └── email/     React Email templates
├── turbo.json
└── pnpm-workspace.yaml
```

## Tech stack
- **Package manager**: pnpm with workspaces
- **Build system**: Turborepo
- **API**: Fastify + TypeScript
- **Web**: Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **ORM**: Prisma (PostgreSQL)
- **Cache / queues**: Redis (ioredis) + BullMQ
- **Auth**: JWT — three separate secrets (VENUE, PLAYER, PLATFORM)
- **Payments**: PayHere gateway (Sri Lanka) — pluggable adapter pattern
- **Email**: Self-hosted Postal SMTP server
- **File storage**: Cloudflare R2 (S3-compatible, AWS SDK)
- **Deployment**: API on Railway, Web on Vercel

## Database — key design decisions
- Multi-tenant: every table scoped by company_id
- Hierarchy: Company → Location → SubVenue → TimeSlot
- Double-booking prevention: Redis SET NX EX 600 + PostgreSQL SELECT FOR UPDATE
- Slot lock stored in time_slots.lock_token + locked_until columns
- All sensitive credentials (payment gateway keys) encrypted with AES-256
  using ENCRYPTION_KEY env var before storing in DB

## Auth system — CRITICAL
Three separate JWT token types, each with its own secret:
1. `venue_staff` — signed with VENUE_JWT_SECRET (15min expiry)
   Payload: { sub, type, company_id, role_key, tier, location_ids, permissions }
2. `player` — signed with PLAYER_JWT_SECRET (24hr expiry)
   Payload: { sub, type, email }
3. `platform_admin` — signed with PLATFORM_JWT_SECRET (15min expiry)
   Payload: { sub, type, platform_role }

RBAC middleware reads token type first, picks correct secret, verifies,
then attaches req.actor. Never mix secrets between token types.

Permission keys are baked into the venue_staff token at login time.
No DB call on every request — pure in-memory string comparison.
location_ids: [] means owner (access all). Non-empty = scoped to those locations.

## Subscription tiers and feature gates
- basic:  1 location, marketplace profile, admin + receptionist
- pro:    multi-location, branded subdomain, location_manager role
- elite:  unlimited locations, custom domain, full RBAC, custom email

Tier is stored in JWT. Check: TIER_RANK = { basic:1, pro:2, elite:3 }
requirePermission() guard takes optional { minTier } option.

## RBAC permission keys (seeded in DB)
locations.read, locations.write, locations.delete, locations.multi (pro+)
sub_venues.write, slots.read, slots.write, pricing.write
bookings.read, bookings.checkin, bookings.cancel
payments.read, payments.verify_slip, payments.gateway_config
reports.daily, reports.full_ledger, staff.invite, company.branding
company.subdomain (pro+), company.custom_domain (elite+)
email.custom_config (elite+), rbac.custom_roles (elite+)

## Payment gateway — pluggable adapter
All payment logic goes through GatewayDriver interface:
  buildCheckoutPayload(booking, config): object
  verifyWebhook(payload): boolean
  parseWebhookStatus(payload): 'paid' | 'failed' | 'pending'

Phase 1: PayhereDriver only.
Resolver checks venue_payment_configs table first. Falls back to platform
master credentials from env vars if no venue config exists.
Webhook endpoint: POST /api/v1/payments/webhook/payhere (public, hash-verified)
Always include booking_id in PayHere custom_1 field for webhook routing.

## Email system
Phase 1: platform SMTP only (Postal server).
From address: noreply@yourplatform.com for all Tier 1 venues.
Email sending goes through BullMQ job — never synchronous in request handler.
Templates live in packages/email using React Email.
Template keys: booking_confirmed, booking_cancelled, payment_pending,
slip_approved, slip_rejected, booking_reminder, welcome_player, password_reset

## API conventions
- Base path: /api/v1/
- All responses: { data, error, meta } shape
- Errors: { error: string, code: string, details?: object }
- Pagination: { page, limit, total } in meta
- Validation: Zod on all request bodies — fail fast, never trust input
- IDs: UUID v4 everywhere — no auto-increment integers exposed
- Soft deletes: status = 'inactive', never hard DELETE on core entities
- Timestamps: all UTC, ISO 8601 strings in responses

## Folder conventions
- Route files export a register(fastify) function, imported in app.ts
- Services handle DB + business logic — routes stay thin
- Jobs are pure functions that take a payload — registered in worker/src/index.ts
- Shared types imported from @sports-booking/types package

## Environment variables required (all apps)
DATABASE_URL, REDIS_URL
VENUE_JWT_SECRET, PLAYER_JWT_SECRET, PLATFORM_JWT_SECRET
PAYHERE_MERCHANT_ID, PAYHERE_SECRET (platform master)
ENCRYPTION_KEY (AES-256, 32 bytes hex)
SMTP_HOST, SMTP_PORT, SMTP_FROM
STORAGE_ENDPOINT, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_BUCKET
NEXT_PUBLIC_API_URL (web app only)

All env vars validated with Zod at startup in each app.
App must throw and refuse to start if any required var is missing.

## What NOT to do
- Never hard-code credentials or secrets anywhere
- Never skip RBAC middleware on a non-public route
- Never do email sending synchronously inside a request handler
- Never expose raw Prisma errors to API responses
- Never use auto-increment IDs in API responses
- Never allow a manager to access a location outside their location_ids
- Never skip hash verification on PayHere webhook callbacks
- Never store payment gateway credentials unencrypted in DB