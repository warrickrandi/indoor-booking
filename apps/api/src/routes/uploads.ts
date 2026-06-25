import type { FastifyInstance } from 'fastify'
import { authMiddleware } from '../middleware/auth.js'
import { ValidationError, NotFoundError, ForbiddenError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { assertVenueAccess } from '../services/booking.service.js'
import { uploadFile } from '../lib/storage.js'

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const MAX_SIZE_BYTES = 5 * 1024 * 1024

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
  'application/pdf': 'pdf',
}

export async function register(fastify: FastifyInstance) {
  fastify.post('/slip', { preHandler: [authMiddleware] }, async (req, reply) => {
    let bookingId: string | undefined
    let fileBuffer: Buffer | undefined
    let mimetype: string | undefined

    for await (const part of req.parts()) {
      if (part.type === 'file') {
        if (!ALLOWED_MIME_TYPES.has(part.mimetype)) {
          throw new ValidationError('Unsupported file type. Allowed: JPEG, PNG, WEBP, PDF')
        }
        const buffer = await part.toBuffer()
        if (buffer.length > MAX_SIZE_BYTES) {
          throw new ValidationError('File exceeds 5MB limit')
        }
        fileBuffer = buffer
        mimetype = part.mimetype
      } else if (part.fieldname === 'booking_id') {
        bookingId = String(part.value)
      }
    }

    if (!bookingId) {
      throw new ValidationError('booking_id is required')
    }
    if (!fileBuffer || !mimetype) {
      throw new ValidationError('slip file is required')
    }

    const booking = await prisma.booking.findUnique({
      where:   { id: bookingId },
      include: { time_slot: { include: { sub_venue: true } } },
    })
    if (!booking) {
      throw new NotFoundError('Booking')
    }

    if (req.actor.type === 'player') {
      if (booking.customer_id !== req.actor.sub) {
        throw new NotFoundError('Booking')
      }
    } else if (req.actor.type === 'venue_staff') {
      if (booking.company_id !== req.actor.company_id) {
        throw new NotFoundError('Booking')
      }
      assertVenueAccess(req.actor, booking.time_slot.sub_venue.location_id)
    } else {
      throw new ForbiddenError('Platform admins cannot upload payment slips')
    }

    const ext = EXT_BY_MIME[mimetype] ?? 'bin'
    const key = `slips/${booking.company_id}/${booking.id}/${Date.now()}.${ext}`
    const url = await uploadFile(key, fileBuffer, mimetype)

    return reply.status(201).send({ data: { url } })
  })
}
