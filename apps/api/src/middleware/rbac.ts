import type { FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js'

export const TIER_RANK: Record<string, number> = {
  basic: 1,
  pro:   2,
  elite: 3,
}

interface RequirePermissionOptions {
  minTier?: 'basic' | 'pro' | 'elite'
}

export function requirePermission(
  permissionKey: string,
  options: RequirePermissionOptions = {},
) {
  return async function rbacMiddleware(
    req: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!req.actor) {
      throw new UnauthorizedError()
    }

    // Platform admins bypass all company-level RBAC checks.
    if (req.actor.type === 'platform_admin') {
      return
    }

    if (req.actor.type !== 'venue_staff') {
      throw new ForbiddenError('Only venue staff can access this resource')
    }

    const actor = req.actor

    if (options.minTier !== undefined) {
      const actorRank    = TIER_RANK[actor.tier] ?? 0
      const requiredRank = TIER_RANK[options.minTier] ?? 0
      if (actorRank < requiredRank) {
        throw new ForbiddenError(
          `This feature requires a ${options.minTier} subscription or higher`,
          { required_tier: options.minTier },
        )
      }
    }

    if (!actor.permissions.includes(permissionKey)) {
      throw new ForbiddenError(`Missing permission: ${permissionKey}`)
    }

    if (actor.location_ids.length > 0) {
      const params = req.params as Record<string, string | undefined>
      const locationId = params['locationId']
      if (locationId && !actor.location_ids.includes(locationId)) {
        throw new ForbiddenError('You do not have access to this location')
      }
    }
  }
}

interface RequirePlatformAdminOptions {
  roles?: Array<'super_admin' | 'platform_support'>
}

export function requirePlatformAdmin(options: RequirePlatformAdminOptions = {}) {
  const allowed = options.roles ?? ['super_admin', 'platform_support']

  return async function platformAdminMiddleware(
    req: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!req.actor) {
      throw new UnauthorizedError()
    }

    if (req.actor.type !== 'platform_admin') {
      throw new ForbiddenError('Platform admin access required')
    }

    if (!allowed.includes(req.actor.platform_role as 'super_admin' | 'platform_support')) {
      throw new ForbiddenError('Insufficient platform role')
    }
  }
}
