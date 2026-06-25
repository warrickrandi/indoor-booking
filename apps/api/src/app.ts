import Fastify, { type FastifyInstance, type FastifyError } from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import formbody from '@fastify/formbody'
import { ZodError } from 'zod'
import { env } from './lib/env.js'
import { redis } from './lib/redis.js'
import { AppError } from './lib/errors.js'
import { healthRoutes } from './routes/health.js'
import { register as registerAuthRoutes } from './routes/auth.js'
import { register as registerMarketplaceRoutes } from './routes/marketplace.js'
import { register as registerCompanyRoutes } from './routes/company.js'
import { register as registerEmailConfigRoutes } from './routes/email-config.js'
import { register as registerDomainRoutes } from './routes/domains.js'
import { register as registerLocationRoutes } from './routes/locations.js'
import { register as registerSubVenueRoutes } from './routes/sub-venues.js'
import { register as registerSlotRoutes } from './routes/slots.js'
import { register as registerBookingRoutes } from './routes/bookings.js'
import { register as registerPaymentRoutes } from './routes/payments.js'
import { register as registerUploadRoutes } from './routes/uploads.js'
import { register as registerAdminRoutes } from './routes/admin.js'
import { register as registerReportsRoutes } from './routes/reports.js'
import { register as registerBillingRoutes } from './routes/billing.js'

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: { level: env.NODE_ENV === 'production' ? 'warn' : 'info' },
  })

  // 1. Security headers
  await fastify.register(helmet, { contentSecurityPolicy: false })

  // 2. CORS
  await fastify.register(cors, {
    origin:      env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  })

  // 3. Rate limiting (Redis-backed for multi-instance consistency)
  await fastify.register(rateLimit, {
    redis,
    max:          100,
    timeWindow:   '1 minute',
    keyGenerator: (req) =>
      (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip,
  })

  // 4. Multipart (for bank-transfer slip uploads)
  await fastify.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  })

  // 4b. Form-encoded bodies (PayHere webhook)
  await fastify.register(formbody)

  // 4c. Request ID on every response (for tracing/log correlation)
  fastify.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Request-Id', req.id)
    return payload
  })

  // 5. Global error handler
  fastify.setErrorHandler((error: FastifyError, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error:   'Validation failed',
        code:    'VALIDATION_ERROR',
        details: error.flatten(),
      })
    }

    if (error instanceof AppError) {
      const body: Record<string, unknown> = {
        error: error.message,
        code:  error.code,
      }
      if ('details' in error && error.details) {
        body['details'] = error.details
      }
      return reply.status(error.statusCode).send(body)
    }

    // Fastify schema validation errors
    if (error.validation) {
      return reply.status(400).send({
        error:   'Validation failed',
        code:    'VALIDATION_ERROR',
        details: error.validation,
      })
    }

    fastify.log.error(error)
    return reply.status(500).send({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' })
  })

  // 6. Routes
  await fastify.register(healthRoutes, { prefix: '/api/v1' })
  await fastify.register(registerAuthRoutes, { prefix: '/api/v1/auth' })
  await fastify.register(registerMarketplaceRoutes, { prefix: '/api/v1/marketplace' })
  await fastify.register(registerCompanyRoutes, { prefix: '/api/v1/company' })
  await fastify.register(registerEmailConfigRoutes, { prefix: '/api/v1/company' })
  await fastify.register(registerDomainRoutes, { prefix: '/api/v1/company' })
  await fastify.register(registerLocationRoutes, { prefix: '/api/v1/locations' })
  await fastify.register(registerSubVenueRoutes, { prefix: '/api/v1/locations' })
  await fastify.register(registerSlotRoutes, { prefix: '/api/v1/slots' })
  await fastify.register(registerBookingRoutes, { prefix: '/api/v1/bookings' })
  await fastify.register(registerPaymentRoutes, { prefix: '/api/v1/payments' })
  await fastify.register(registerUploadRoutes, { prefix: '/api/v1/uploads' })
  await fastify.register(registerAdminRoutes, { prefix: '/api/v1/admin' })
  await fastify.register(registerReportsRoutes, { prefix: '/api/v1/reports' })
  await fastify.register(registerBillingRoutes, { prefix: '/api/v1/billing' })

  return fastify
}
