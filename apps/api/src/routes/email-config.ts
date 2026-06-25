import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { UpdateEmailConfigBodySchema, TestEmailConfigBodySchema, GenerateDkimKeysBodySchema } from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import {
  getEmailConfig,
  updateEmailConfig,
  verifyEmailConfigDns,
  sendTestEmail,
  generateDkimKeys,
  getDkimSetup,
} from '../services/email-config.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.get(
    '/me/email-config',
    { preHandler: [authMiddleware, requirePermission('company.branding')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await getEmailConfig(actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/me/email-config',
    {
      schema:     { body: zodToJsonSchema(UpdateEmailConfigBodySchema) },
      preHandler: [authMiddleware, requirePermission('company.branding')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const body = UpdateEmailConfigBodySchema.parse(req.body)
      const result = await updateEmailConfig(actor, body)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/me/email-config/verify',
    { preHandler: [authMiddleware, requirePermission('company.branding')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await verifyEmailConfigDns(actor)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/me/email-config/test',
    {
      schema:     { body: zodToJsonSchema(TestEmailConfigBodySchema) },
      preHandler: [authMiddleware, requirePermission('company.branding')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const body = TestEmailConfigBodySchema.parse(req.body)
      const result = await sendTestEmail(actor, body.to_address)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/me/email-config/dkim/generate',
    {
      schema:     { body: zodToJsonSchema(GenerateDkimKeysBodySchema) },
      preHandler: [authMiddleware, requirePermission('company.branding', { minTier: 'elite' })],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const body = GenerateDkimKeysBodySchema.parse(req.body)
      const result = await generateDkimKeys(actor, body.selector)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/me/email-config/dkim',
    { preHandler: [authMiddleware, requirePermission('company.branding', { minTier: 'elite' })] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await getDkimSetup(actor)
      return reply.send({ data: result })
    },
  )
}
