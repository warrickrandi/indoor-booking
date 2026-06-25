import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  GetSlotsQuerySchema,
  SlotCalendarQuerySchema,
  UpdateSlotBodySchema,
  UnlockSlotBodySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import { ValidationError } from '../lib/errors.js'
import { getTodayLocalDateString } from '../lib/datetime.js'
import {
  getAvailableSlots,
  getSlotDetail,
  getSlotCalendar,
  lockSlot,
  unlockSlot,
  updateSlot,
  deleteSlot,
} from '../services/slot.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.get('/', async (req, reply) => {
    const query = GetSlotsQuerySchema.parse(req.query)
    if (query.date < getTodayLocalDateString()) {
      throw new ValidationError('date cannot be in the past')
    }
    const result = await getAvailableSlots(query.sub_venue_id, query.date)
    return reply.send({ data: result })
  })

  fastify.get(
    '/calendar',
    { preHandler: [authMiddleware, requirePermission('slots.read')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const query = SlotCalendarQuerySchema.parse(req.query)
      const result = await getSlotCalendar(
        query.location_id,
        actor.company_id,
        actor.location_ids,
        query.from_date,
        query.to_date,
      )
      return reply.send({ data: result })
    },
  )

  fastify.get('/:slotId', async (req, reply) => {
    const { slotId } = req.params as { slotId: string }
    const result = await getSlotDetail(slotId)
    return reply.send({ data: result })
  })

  fastify.post('/:slotId/lock', async (req, reply) => {
    const { slotId } = req.params as { slotId: string }
    const result = await lockSlot(slotId)
    return reply.send({ data: result })
  })

  fastify.post(
    '/:slotId/unlock',
    {
      schema:     { body: zodToJsonSchema(UnlockSlotBodySchema) },
      preHandler: [authMiddleware],
    },
    async (req, reply) => {
      const { slotId } = req.params as { slotId: string }
      const body = UnlockSlotBodySchema.parse(req.body)
      const result = await unlockSlot(slotId, body.lock_token)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/:slotId',
    {
      schema:     { body: zodToJsonSchema(UpdateSlotBodySchema) },
      preHandler: [authMiddleware, requirePermission('slots.write')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { slotId } = req.params as { slotId: string }
      const body = UpdateSlotBodySchema.parse(req.body)
      const result = await updateSlot(slotId, actor, body)
      return reply.send({ data: result })
    },
  )

  fastify.delete(
    '/:slotId',
    { preHandler: [authMiddleware, requirePermission('slots.write')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { slotId } = req.params as { slotId: string }
      const result = await deleteSlot(slotId, actor)
      return reply.send({ data: result })
    },
  )
}
