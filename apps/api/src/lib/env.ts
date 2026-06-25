import { z } from 'zod'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

// Load .env from the app root first, then fall back to the monorepo root.
// This allows per-app overrides while keeping a single root .env for dev.
loadEnv({ path: resolve(process.cwd(), '.env'), override: false })
loadEnv({ path: resolve(process.cwd(), '../../.env'), override: false })

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT:     z.coerce.number().default(3001),
  HOST:     z.string().default('0.0.0.0'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),
  REDIS_URL:    z.string().url(),

  VENUE_JWT_SECRET:    z.string().min(32),
  PLAYER_JWT_SECRET:   z.string().min(32),
  PLATFORM_JWT_SECRET: z.string().min(32),

  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes)'),

  PAYHERE_MERCHANT_ID: z.string().min(1),
  PAYHERE_SECRET:      z.string().min(1),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_FROM: z.string().email(),

  STORAGE_ENDPOINT:   z.string().url(),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET:     z.string().min(1),

  FRONTEND_URL: z.string().url(),
  API_URL:      z.string().url(),

  PLATFORM_DOMAIN:   z.string().min(1),
  VERCEL_TOKEN:      z.string().min(1).optional(),
  VERCEL_PROJECT_ID: z.string().min(1).optional(),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof parsed.data
