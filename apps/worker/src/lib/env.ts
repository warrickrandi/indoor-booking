import { z } from 'zod'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'

loadEnv({ path: resolve(process.cwd(), '.env'), override: false })
loadEnv({ path: resolve(process.cwd(), '../../.env'), override: false })

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().url(),
  REDIS_URL:    z.string().url(),

  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes)'),

  SMTP_HOST:     z.string().min(1),
  SMTP_PORT:     z.coerce.number().default(587),
  SMTP_FROM:     z.string().email(),
  SMTP_USER:     z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),

  FRONTEND_URL: z.string().url(),

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
