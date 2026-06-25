import type { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import {
  VenueStaffActorSchema,
  PlayerActorSchema,
  PlatformAdminActorSchema,
  type Actor,
} from '@sports-booking/types'
import { env } from '../lib/env.js'
import { UnauthorizedError } from '../lib/errors.js'

function secretForType(type: string): string {
  switch (type) {
    case 'venue_staff':    return env.VENUE_JWT_SECRET
    case 'player':         return env.PLAYER_JWT_SECRET
    case 'platform_admin': return env.PLATFORM_JWT_SECRET
    default:
      throw new UnauthorizedError(`Unknown token type: ${type}`)
  }
}

export async function authMiddleware(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Bearer token')
  }

  const token = header.slice(7)

  // Phase 1: decode without verification to read `type`
  const decoded = jwt.decode(token)
  if (!decoded || typeof decoded !== 'object' || !decoded['type']) {
    throw new UnauthorizedError('Malformed token')
  }

  // Phase 2: verify with the correct secret for this token type
  const secret = secretForType(decoded['type'] as string)

  let payload: unknown
  try {
    payload = jwt.verify(token, secret)
  } catch {
    throw new UnauthorizedError('Invalid or expired token')
  }

  // Phase 3: validate full payload shape with Zod
  const type = (payload as Record<string, unknown>)['type']
  let actor: Actor

  if (type === 'venue_staff') {
    actor = VenueStaffActorSchema.parse(payload)
  } else if (type === 'player') {
    actor = PlayerActorSchema.parse(payload)
  } else {
    actor = PlatformAdminActorSchema.parse(payload)
  }

  req.actor = actor
}
