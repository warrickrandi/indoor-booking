import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  CreateLocationBodySchema,
  UpdateLocationBodySchema,
  UpdateHoursBodySchema,
  CreateHolidayBodySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import {
  listLocations,
  createLocation,
  getLocation,
  updateLocation,
  updateHours,
  listHolidays,
  createHoliday,
  deleteHoliday,
  deleteLocation,
} from '../services/location.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: [authMiddleware, requirePermission('locations.read')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await listLocations(actor.company_id, actor.location_ids)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/',
    {
      schema:     { body: zodToJsonSchema(CreateLocationBodySchema) },
      preHandler: [authMiddleware, requirePermission('locations.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const body = CreateLocationBodySchema.parse(req.body)
      const result = await createLocation(actor.company_id, actor.tier, body)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/:locationId',
    { preHandler: [authMiddleware, requirePermission('locations.read')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId } = req.params as { locationId: string }
      const result = await getLocation(locationId, actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/:locationId',
    {
      schema:     { body: zodToJsonSchema(UpdateLocationBodySchema) },
      preHandler: [authMiddleware, requirePermission('locations.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId } = req.params as { locationId: string }
      const body = UpdateLocationBodySchema.parse(req.body)
      const result = await updateLocation(locationId, actor.company_id, body)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/:locationId/hours',
    {
      schema:     { body: zodToJsonSchema(UpdateHoursBodySchema) },
      preHandler: [authMiddleware, requirePermission('locations.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId } = req.params as { locationId: string }
      const body = UpdateHoursBodySchema.parse(req.body)
      const result = await updateHours(locationId, actor.company_id, body.hours)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/:locationId/holidays',
    { preHandler: [authMiddleware, requirePermission('locations.read')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId } = req.params as { locationId: string }
      const result = await listHolidays(locationId, actor.company_id)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:locationId/holidays',
    {
      schema:     { body: zodToJsonSchema(CreateHolidayBodySchema) },
      preHandler: [authMiddleware, requirePermission('locations.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId } = req.params as { locationId: string }
      const body = CreateHolidayBodySchema.parse(req.body)
      const result = await createHoliday(locationId, actor.company_id, body)
      return reply.send({ data: result })
    },
  )

  fastify.delete(
    '/:locationId/holidays/:holidayId',
    { preHandler: [authMiddleware, requirePermission('locations.write')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId, holidayId } = req.params as { locationId: string; holidayId: string }
      const result = await deleteHoliday(locationId, actor.company_id, holidayId)
      return reply.send({ data: result })
    },
  )

  fastify.delete(
    '/:locationId',
    { preHandler: [authMiddleware, requirePermission('locations.delete')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { locationId } = req.params as { locationId: string }
      const result = await deleteLocation(locationId, actor.company_id)
      return reply.send({ data: result })
    },
  )
}
