import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  CreateBookingBodySchema,
  CancelBookingBodySchema,
  ListBookingsQuerySchema,
  UploadSlipBodySchema,
  VerifySlipBodySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import { ValidationError, ForbiddenError } from '../lib/errors.js'
import {
  createBooking,
  getBooking,
  listBookings,
  getBookingStatusLog,
  cancelBooking,
  checkIn,
  markPaid,
  uploadSlip,
  verifySlip,
} from '../services/booking.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.post(
    '/',
    {
      schema:     { body: zodToJsonSchema(CreateBookingBodySchema) },
      preHandler: [authMiddleware],
    },
    async (req, reply) => {
      const body = CreateBookingBodySchema.parse(req.body)
      if (req.actor.type === 'player' && body.payment_method === 'pay_at_venue') {
        throw new ValidationError('Players cannot book pay_at_venue — choose online or bank_transfer')
      }
      const result = await createBooking(req.actor, body)
      return reply.status(201).send({ data: result })
    },
  )

  fastify.get(
    '/',
    { preHandler: [authMiddleware, requirePermission('bookings.read')] },
    async (req, reply) => {
      const query = ListBookingsQuerySchema.parse(req.query)
      const result = await listBookings(req.actor, query)
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
      const query = ListBookingsQuerySchema.parse(req.query)
      const result = await listBookings(req.actor, query)
      return reply.send(result)
    },
  )

  fastify.get(
    '/:bookingId',
    { preHandler: [authMiddleware] },
    async (req, reply) => {
      const { bookingId } = req.params as { bookingId: string }
      const result = await getBooking(bookingId, req.actor)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/:bookingId/status-log',
    { preHandler: [authMiddleware, requirePermission('bookings.read')] },
    async (req, reply) => {
      const { bookingId } = req.params as { bookingId: string }
      const result = await getBookingStatusLog(bookingId, req.actor)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:bookingId/cancel',
    {
      schema:     { body: zodToJsonSchema(CancelBookingBodySchema) },
      preHandler: [authMiddleware],
    },
    async (req, reply) => {
      const { bookingId } = req.params as { bookingId: string }
      const body = CancelBookingBodySchema.parse(req.body)
      const result = await cancelBooking(bookingId, req.actor, body.reason)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:bookingId/check-in',
    { preHandler: [authMiddleware, requirePermission('bookings.checkin')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { bookingId } = req.params as { bookingId: string }
      const result = await checkIn(bookingId, actor)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:bookingId/mark-paid',
    { preHandler: [authMiddleware, requirePermission('bookings.checkin')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { bookingId } = req.params as { bookingId: string }
      const result = await markPaid(bookingId, actor)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/:bookingId/slip',
    {
      schema:     { body: zodToJsonSchema(UploadSlipBodySchema) },
      preHandler: [authMiddleware],
    },
    async (req, reply) => {
      const { bookingId } = req.params as { bookingId: string }
      const body = UploadSlipBodySchema.parse(req.body)
      const result = await uploadSlip(bookingId, req.actor, body)
      return reply.status(201).send({ data: result })
    },
  )

  fastify.post(
    '/:bookingId/slip/verify',
    {
      schema:     { body: zodToJsonSchema(VerifySlipBodySchema) },
      preHandler: [authMiddleware, requirePermission('payments.verify_slip')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { bookingId } = req.params as { bookingId: string }
      const body = VerifySlipBodySchema.parse(req.body)
      const result = await verifySlip(bookingId, actor, body)
      return reply.send({ data: result })
    },
  )
}
