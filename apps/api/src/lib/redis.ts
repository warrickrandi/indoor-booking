import { Redis } from 'ioredis'
import { env } from './env.js'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message)
})
