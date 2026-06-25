import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_req, reply) => {
    const [dbOk, redisOk] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis.ping().then(() => true).catch(() => false),
    ])

    const status = dbOk && redisOk ? 'ok' : 'degraded'

    return reply.status(status === 'ok' ? 200 : 503).send({
      data: {
        status,
        db:        dbOk ? 'connected' : 'error',
        redis:     redisOk ? 'connected' : 'error',
        timestamp: new Date().toISOString(),
      },
    })
  })
}
