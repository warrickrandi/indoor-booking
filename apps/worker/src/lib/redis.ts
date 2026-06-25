import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { Redis } from 'ioredis'

loadEnv({ path: resolve(process.cwd(), '.env'), override: false })
loadEnv({ path: resolve(process.cwd(), '../../.env'), override: false })

const REDIS_URL = process.env['REDIS_URL']
if (!REDIS_URL) {
  throw new Error('REDIS_URL is not set')
}

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message)
})
