import type { FastifyRequest } from 'fastify'
import type { VenueStaffActor, PlatformAdminActor } from '@sports-booking/types'
import { ForbiddenError } from './errors.js'

export function requireVenueStaff(req: FastifyRequest): VenueStaffActor {
  if (req.actor.type !== 'venue_staff') {
    throw new ForbiddenError('Only venue staff can access this resource')
  }
  return req.actor
}

export function requirePlatformAdminActor(req: FastifyRequest): PlatformAdminActor {
  if (req.actor.type !== 'platform_admin') {
    throw new ForbiddenError('Only platform admins can access this resource')
  }
  return req.actor
}
