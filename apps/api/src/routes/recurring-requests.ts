import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  CreateRecurringRequestBodySchema,
  ListRecurringRequestsQuerySchema,
  ApproveRecurringRequestBodySchema,
  RejectRecurringRequestBodySchema,
  CancelRecurringRequestBodySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import { ForbiddenError } from '../lib/errors.js'
import {
  createRecurringRequest,
  listRecurringRequests,
  getRecurringRequest,
  approveRecurringRequest,
  rejectRecurringRequest,
  cancelRecurringRequest,
} from '../services/recurring-request.service.js'

/** Permanent (weekly) slot requests — submitted by players or staff, reviewed in the backoffice. */
export async function register(fastify: FastifyInstance) {
  fastify.post(
    '/',
    {
      schema:     { body: zodToJsonSchema(CreateRecurringRequestBodySchema) },
      preHandler: [authMiddleware],
    },
    async (req, reply) => {
      if (req.actor.type === 'venue_staff' && !req.actor.permissions.includes('bookings.read')) {
        throw new ForbiddenError('Missing permission: bookings.read')
      }
      const body = CreateRecurringRequestBodySchema.parse(req.body)
      const result = await createRecurringRequest(req.actor, body)
      return reply.status(201).send({ data: result })
    },
  )

  fastify.get(
    '/',
    { preHandler: [authMiddleware, requirePermission('bookings.read')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const query = ListRecurringRequestsQuerySchema.parse(req.query)
      const result = await listRecurringRequests(actor, query)
      return reply.send(result)
    },
  )

  fastify.get(
    '/my',
    { preHandler: [authMiddleware] },
    async (req, reply) => {
      if (req.actor.type !== 'player') {
        throw new ForbiddenError('Only players can access this resource')
      }
      const query = ListRecurringRequestsQuerySchema.parse(req.query)
      const result = await listRecurringRequests(req.actor, query)
      return reply.send(result)
    },
  )

  fastify.get(
    '/:requestId',
    { preHandler: [authMiddleware] },
    async (req, reply) => {
      if (req.actor.type === 'venue_staff' && !req.actor.permissions.includes('bookings.read')) {
        throw new ForbiddenError('Missing permission: bookings.read')
      }
      const { requestId } = req.params as { requestId: string }
      const result = await getRecurringRequest(requestId, req.actor)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:requestId/approve',
    {
      schema:     { body: zodToJsonSchema(ApproveRecurringRequestBodySchema) },
      preHandler: [authMiddleware, requirePermission('bookings.read')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { requestId } = req.params as { requestId: string }
      const body = ApproveRecurringRequestBodySchema.parse(req.body ?? {})
      const result = await approveRecurringRequest(requestId, actor, body)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:requestId/reject',
    {
      schema:     { body: zodToJsonSchema(RejectRecurringRequestBodySchema) },
      preHandler: [authMiddleware, requirePermission('bookings.read')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { requestId } = req.params as { requestId: string }
      const body = RejectRecurringRequestBodySchema.parse(req.body)
      const result = await rejectRecurringRequest(requestId, actor, body)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:requestId/cancel',
    {
      schema:     { body: zodToJsonSchema(CancelRecurringRequestBodySchema) },
      preHandler: [authMiddleware],
    },
    async (req, reply) => {
      const { requestId } = req.params as { requestId: string }
      const body = CancelRecurringRequestBodySchema.parse(req.body ?? {})
      const result = await cancelRecurringRequest(requestId, req.actor, body)
      return reply.send({ data: result })
    },
  )
}
