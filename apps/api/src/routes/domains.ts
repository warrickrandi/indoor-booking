import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { AddDomainBodySchema } from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import { getDomainSettings, addCustomDomain, verifyDomain, removeDomain } from '../services/domain.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.get(
    '/me/domains',
    { preHandler: [authMiddleware, requirePermission('company.branding')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await getDomainSettings(actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/me/domains',
    {
      schema:     { body: zodToJsonSchema(AddDomainBodySchema) },
      preHandler: [authMiddleware, requirePermission('company.custom_domain', { minTier: 'elite' })],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const body = AddDomainBodySchema.parse(req.body)
      const result = await addCustomDomain(actor.company_id, body.domain, actor)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/me/domains/:domainId/verify',
    { preHandler: [authMiddleware, requirePermission('company.custom_domain', { minTier: 'elite' })] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { domainId } = req.params as { domainId: string }
      const result = await verifyDomain(actor.company_id, domainId, actor)
      return reply.send({ data: result })
    },
  )

  fastify.delete(
    '/me/domains/:domainId',
    { preHandler: [authMiddleware, requirePermission('company.custom_domain', { minTier: 'elite' })] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { domainId } = req.params as { domainId: string }
      const result = await removeDomain(actor.company_id, domainId, actor)
      return reply.send({ data: result })
    },
  )
}
