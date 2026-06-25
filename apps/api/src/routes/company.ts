import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  UpdateCompanyBodySchema,
  UpdateBrandingBodySchema,
  InviteMemberBodySchema,
  UpdateMemberBodySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import {
  getCompany,
  updateCompany,
  upsertBranding,
  getSubscription,
  getMembers,
  inviteMember,
  updateMember,
  removeMember,
} from '../services/company.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.get(
    '/me',
    { preHandler: [authMiddleware, requirePermission('locations.read')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await getCompany(actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/me',
    {
      schema:     { body: zodToJsonSchema(UpdateCompanyBodySchema) },
      preHandler: [authMiddleware, requirePermission('company.branding')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const body = UpdateCompanyBodySchema.parse(req.body)
      const result = await updateCompany(actor.company_id, body)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/me/branding',
    {
      schema:     { body: zodToJsonSchema(UpdateBrandingBodySchema) },
      preHandler: [authMiddleware, requirePermission('company.branding')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const body = UpdateBrandingBodySchema.parse(req.body)
      const result = await upsertBranding(actor.company_id, body)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/me/subscription',
    { preHandler: [authMiddleware, requirePermission('company.branding')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await getSubscription(actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/me/members',
    { preHandler: [authMiddleware, requirePermission('staff.invite')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await getMembers(actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/me/members/invite',
    {
      schema:     { body: zodToJsonSchema(InviteMemberBodySchema) },
      preHandler: [authMiddleware, requirePermission('staff.invite')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const body = InviteMemberBodySchema.parse(req.body)
      const result = await inviteMember(actor.company_id, body, actor)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/me/members/:memberId',
    {
      schema:     { body: zodToJsonSchema(UpdateMemberBodySchema) },
      preHandler: [authMiddleware, requirePermission('staff.invite')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { memberId } = req.params as { memberId: string }
      const body = UpdateMemberBodySchema.parse(req.body)
      const result = await updateMember(actor.company_id, memberId, body)
      return reply.send({ data: result })
    },
  )

  fastify.delete(
    '/me/members/:memberId',
    { preHandler: [authMiddleware, requirePermission('staff.invite')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { memberId } = req.params as { memberId: string }
      const result = await removeMember(actor.company_id, memberId, actor)
      return reply.send({ data: result })
    },
  )
}
