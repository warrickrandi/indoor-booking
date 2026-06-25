import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { RegisterBody, LoginBody, VenueStaffActor } from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { slugify } from '../lib/slug.js'
import { signVenueStaffToken, signVenueRefreshToken, signPlatformAdminToken } from '../lib/jwt.js'
import { LOCATION_MANAGER_PERMISSIONS, RECEPTIONIST_PERMISSIONS } from '../lib/role-permissions.js'
import { addEmailJob } from '../jobs/email.job.js'
import { env } from '../lib/env.js'
import { ConflictError, UnauthorizedError } from '../lib/errors.js'

const BCRYPT_ROUNDS = 12
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60
const RESET_TTL_SECONDS = 60 * 60

function refreshKey(userId: string): string {
  return `refresh:${userId}`
}

async function generateUniqueSlug(base: string): Promise<string> {
  const root = slugify(base)
  let slug = root
  let suffix = 1
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.company.findUnique({ where: { slug } })) {
    suffix += 1
    slug = `${root}-${suffix}`
  }
  return slug
}

function serializeUser(user: { id: string; full_name: string; email: string; phone: string | null }) {
  return { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone }
}

function serializeCompany(company: {
  id: string
  name: string
  slug: string
  status: string
  plan: { name: string; tier: string }
}) {
  return {
    id:     company.id,
    name:   company.name,
    slug:   company.slug,
    status: company.status,
    plan:   { name: company.plan.name, tier: company.plan.tier },
  }
}

export async function registerVenueOwner(input: RegisterBody) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } })
  if (existingUser) {
    throw new ConflictError('Email already registered')
  }

  let slug: string
  if (input.slug) {
    slug = slugify(input.slug)
    const existingCompany = await prisma.company.findUnique({ where: { slug } })
    if (existingCompany) {
      throw new ConflictError('Slug already taken')
    }
  } else {
    slug = await generateUniqueSlug(input.company_name)
  }

  const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)

  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { name: 'basic' } })

    const company = await tx.company.create({
      data: { name: input.company_name, slug, plan_id: plan.id },
    })

    const user = await tx.user.create({
      data: {
        full_name: input.full_name,
        email:     input.email,
        phone:     input.phone,
        password_hash,
      },
    })

    const allPermissions = await tx.companyPermission.findMany()
    const permissionIdByKey = new Map(allPermissions.map((p) => [p.key, p.id]))

    const roleDefs = [
      { name: 'owner', permissionKeys: allPermissions.map((p) => p.key) },
      { name: 'location_manager', permissionKeys: LOCATION_MANAGER_PERMISSIONS },
      { name: 'receptionist', permissionKeys: RECEPTIONIST_PERMISSIONS },
    ] as const

    let ownerRoleId = ''
    for (const def of roleDefs) {
      const role = await tx.companyRole.create({
        data: { company_id: company.id, name: def.name, is_system: true },
      })

      if (def.name === 'owner') {
        ownerRoleId = role.id
      }

      const rolePermissions = def.permissionKeys
        .map((key) => permissionIdByKey.get(key))
        .filter((id): id is string => id !== undefined)
        .map((permission_id) => ({ role_id: role.id, permission_id }))

      if (rolePermissions.length > 0) {
        await tx.companyRolePermission.createMany({ data: rolePermissions })
      }
    }

    await tx.companyMember.create({
      data: {
        company_id: company.id,
        user_id:    user.id,
        role_id:    ownerRoleId,
        status:     'active',
        joined_at:  new Date(),
      },
    })

    await tx.companyBranding.create({ data: { company_id: company.id } })

    return { plan, company, user, ownerPermissions: allPermissions.map((p) => p.key) }
  })

  const { plan, company, user, ownerPermissions } = result

  const access_token: string = signVenueStaffToken({
    sub:          user.id,
    company_id:   company.id,
    role_key:     'owner',
    tier:         plan.tier as VenueStaffActor['tier'],
    location_ids: [],
    permissions:  ownerPermissions,
  })
  const refresh_token = signVenueRefreshToken(user.id)
  await redis.set(refreshKey(user.id), refresh_token, 'EX', REFRESH_TTL_SECONDS)

  await addEmailJob(user.email, 'welcome_owner', {
    customerName: user.full_name,
    companyName:  company.name,
    dashboardUrl: `${env.FRONTEND_URL}/overview`,
  }, { companyId: company.id })

  return {
    user:    serializeUser(user),
    company: serializeCompany({ ...company, plan }),
    access_token,
    refresh_token,
  }
}

async function loadActiveMembership(userId: string) {
  const member = await prisma.companyMember.findFirst({
    where: { user_id: userId, status: 'active' },
    include: {
      company: { include: { plan: true } },
      role:    { include: { permissions: { include: { permission: true } } } },
      location_assignments: true,
    },
  })

  if (!member) {
    throw new UnauthorizedError('No active company membership found')
  }

  return {
    member,
    permissions:  member.role.permissions.map((rp) => rp.permission.key),
    location_ids: member.location_assignments.map((a) => a.location_id),
    tier:         member.company.plan.tier as VenueStaffActor['tier'],
  }
}

export async function loginVenueStaff(input: LoginBody) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const valid = await bcrypt.compare(input.password, user.password_hash)
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const { member, permissions, location_ids, tier } = await loadActiveMembership(user.id)

  const access_token = signVenueStaffToken({
    sub:          user.id,
    company_id:   member.company.id,
    role_key:     member.role.name,
    tier,
    location_ids,
    permissions,
  })
  const refresh_token = signVenueRefreshToken(user.id)
  await redis.set(refreshKey(user.id), refresh_token, 'EX', REFRESH_TTL_SECONDS)

  await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } })

  return {
    access_token,
    refresh_token,
    user:    serializeUser(user),
    company: serializeCompany(member.company),
  }
}

export async function loginPlatformAdmin(input: LoginBody) {
  const user = await prisma.user.findUnique({
    where:   { email: input.email },
    include: { platform_roles: { include: { role: true } } },
  })
  if (!user) {
    throw new UnauthorizedError('Invalid email or password')
  }

  const valid = await bcrypt.compare(input.password, user.password_hash)
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password')
  }

  if (user.platform_roles.length === 0) {
    throw new UnauthorizedError('This account does not have platform admin access')
  }

  const roleNames = user.platform_roles.map((pr) => pr.role.name)
  const platform_role = roleNames.includes('super_admin') ? 'super_admin' : roleNames[0]!

  const access_token = signPlatformAdminToken({ sub: user.id, platform_role })

  await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } })

  return {
    access_token,
    user: serializeUser(user),
  }
}

export async function refreshVenueToken(refreshToken: string) {
  const decoded = jwt.decode(refreshToken)
  if (!decoded || typeof decoded !== 'object' || typeof decoded['sub'] !== 'string') {
    throw new UnauthorizedError('Invalid refresh token')
  }
  const userId = decoded['sub']

  const stored = await redis.get(refreshKey(userId))
  if (!stored || stored !== refreshToken) {
    throw new UnauthorizedError('Invalid or expired refresh token')
  }

  const { member, permissions, location_ids, tier } = await loadActiveMembership(userId)

  const access_token = signVenueStaffToken({
    sub:          userId,
    company_id:   member.company.id,
    role_key:     member.role.name,
    tier,
    location_ids,
    permissions,
  })

  // Sliding expiration: keep the same refresh token but renew its TTL.
  await redis.set(refreshKey(userId), refreshToken, 'EX', REFRESH_TTL_SECONDS)

  return { access_token }
}

export async function logoutVenueStaff(userId: string) {
  await redis.del(refreshKey(userId))
  return { message: 'Logged out' }
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  if (user) {
    const token = randomBytes(32).toString('hex')
    await redis.set(`reset:${token}`, user.id, 'EX', RESET_TTL_SECONDS)
    await addEmailJob(user.email, 'password_reset', {
      customerName:  user.full_name,
      resetUrl:      `${env.FRONTEND_URL}/reset-password?token=${token}`,
      expiryMinutes: RESET_TTL_SECONDS / 60,
    }, { companyId: null })
  }

  return { message: 'Reset link sent if account exists' }
}

export async function resetPassword(token: string, newPassword: string) {
  const userId = await redis.get(`reset:${token}`)
  if (!userId) {
    throw new UnauthorizedError('Invalid or expired reset token')
  }

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await prisma.user.update({ where: { id: userId }, data: { password_hash } })
  await redis.del(`reset:${token}`)

  return { message: 'Password updated' }
}
