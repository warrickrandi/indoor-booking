import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  CreateSubVenueBodySchema,
  UpdateSubVenueBodySchema,
  CreatePricingRuleBodySchema,
  UpdatePricingRuleBodySchema,
  GenerateSlotsBodySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import {
  listSubVenues,
  createSubVenue,
  getSubVenue,
  updateSubVenue,
  deleteSubVenue,
  listPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
} from '../services/sub-venue.service.js'
import { verifySubVenueOwnership, generateSlotsForDateRange } from '../services/slot.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.get(
    '/:locationId/sub-venues',
    { preHandler: [authMiddleware, requirePermission('locations.read')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId } = req.params as { locationId: string }
      const result = await listSubVenues(locationId, actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:locationId/sub-venues',
    {
      schema:     { body: zodToJsonSchema(CreateSubVenueBodySchema) },
      preHandler: [authMiddleware, requirePermission('sub_venues.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId } = req.params as { locationId: string }
      const body = CreateSubVenueBodySchema.parse(req.body)
      const result = await createSubVenue(locationId, actor.company_id, body)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/:locationId/sub-venues/:subVenueId',
    { preHandler: [authMiddleware, requirePermission('locations.read')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId, subVenueId } = req.params as { locationId: string; subVenueId: string }
      const result = await getSubVenue(subVenueId, locationId, actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/:locationId/sub-venues/:subVenueId',
    {
      schema:     { body: zodToJsonSchema(UpdateSubVenueBodySchema) },
      preHandler: [authMiddleware, requirePermission('sub_venues.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId, subVenueId } = req.params as { locationId: string; subVenueId: string }
      const body = UpdateSubVenueBodySchema.parse(req.body)
      const result = await updateSubVenue(subVenueId, locationId, actor.company_id, body)
      return reply.send({ data: result })
    },
  )

  fastify.delete(
    '/:locationId/sub-venues/:subVenueId',
    { preHandler: [authMiddleware, requirePermission('sub_venues.write')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId, subVenueId } = req.params as { locationId: string; subVenueId: string }
      const result = await deleteSubVenue(subVenueId, locationId, actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/:locationId/sub-venues/:subVenueId/pricing',
    { preHandler: [authMiddleware, requirePermission('pricing.write')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId, subVenueId } = req.params as { locationId: string; subVenueId: string }
      const result = await listPricingRules(subVenueId, locationId, actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:locationId/sub-venues/:subVenueId/pricing',
    {
      schema:     { body: zodToJsonSchema(CreatePricingRuleBodySchema) },
      preHandler: [authMiddleware, requirePermission('pricing.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId, subVenueId } = req.params as { locationId: string; subVenueId: string }
      const body = CreatePricingRuleBodySchema.parse(req.body)
      const result = await createPricingRule(subVenueId, locationId, actor.company_id, body)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/:locationId/sub-venues/:subVenueId/pricing/:ruleId',
    {
      schema:     { body: zodToJsonSchema(UpdatePricingRuleBodySchema) },
      preHandler: [authMiddleware, requirePermission('pricing.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId, subVenueId, ruleId } = req.params as {
        locationId: string
        subVenueId: string
        ruleId: string
      }
      const body = UpdatePricingRuleBodySchema.parse(req.body)
      const result = await updatePricingRule(ruleId, subVenueId, locationId, actor.company_id, body)
      return reply.send({ data: result })
    },
  )

  fastify.delete(
    '/:locationId/sub-venues/:subVenueId/pricing/:ruleId',
    { preHandler: [authMiddleware, requirePermission('pricing.write')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId, subVenueId, ruleId } = req.params as {
        locationId: string
        subVenueId: string
        ruleId: string
      }
      const result = await deletePricingRule(ruleId, subVenueId, locationId, actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:locationId/sub-venues/:subVenueId/slots/generate',
    {
      schema:     { body: zodToJsonSchema(GenerateSlotsBodySchema) },
      preHandler: [authMiddleware, requirePermission('slots.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId, subVenueId } = req.params as { locationId: string; subVenueId: string }
      const body = GenerateSlotsBodySchema.parse(req.body)
      await verifySubVenueOwnership(subVenueId, locationId, actor.company_id)
      const result = await generateSlotsForDateRange(
        subVenueId,
        body.from_date,
        body.to_date,
        body.overwrite,
        actor,
      )
      return reply.send({ data: result })
    },
  )
}
