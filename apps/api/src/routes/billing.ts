import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { UpgradeSubscriptionBodySchema } from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import {
  getPublicPlans,
  getCurrentSubscription,
  upgradeSubscription,
  cancelSubscription,
  listInvoices,
} from '../services/billing.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.get('/plans', async (_req, reply) => {
    const result = await getPublicPlans()
    return reply.send({ data: result })
  })

  fastify.get(
    '/current',
    { preHandler: [authMiddleware, requirePermission('company.branding')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await getCurrentSubscription(actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/upgrade',
    {
      schema:     { body: zodToJsonSchema(UpgradeSubscriptionBodySchema) },
      preHandler: [authMiddleware, requirePermission('company.branding')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const body = UpgradeSubscriptionBodySchema.parse(req.body)
      const result = await upgradeSubscription(actor, body)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/cancel',
    { preHandler: [authMiddleware, requirePermission('company.branding')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await cancelSubscription(actor)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/invoices',
    { preHandler: [authMiddleware, requirePermission('company.branding')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await listInvoices(actor.company_id)
      return reply.send({ data: result })
    },
  )
}
