import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { CompanyBranding } from '@sports-booking/db'
import type {
  UpdateCompanyBody,
  UpdateBrandingBody,
  InviteMemberBody,
  UpdateMemberBody,
  VenueStaffActor,
} from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { slugify } from '../lib/slug.js'
import { addEmailJob } from '../jobs/email.job.js'
import { env } from '../lib/env.js'
import { createAuditLog } from '../middleware/audit.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'

const BCRYPT_ROUNDS = 12
const RESET_TTL_SECONDS = 60 * 60

function humanizeRoleName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function serializeBranding(branding: CompanyBranding) {
  return {
    primary_color:    branding.primary_color,
    secondary_color:  branding.secondary_color,
    logo_url:         branding.logo_url,
    favicon_url:      branding.favicon_url,
    tagline:          branding.tagline,
    meta_title:       branding.meta_title,
    meta_description: branding.meta_description,
  }
}

export function serializeCompanyDetail(company: {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  status: string
  billing_cycle: string
  trial_ends_at: Date | null
  subscription_expires_at: Date | null
  plan: { name: string; tier: string }
  branding: CompanyBranding | null
}) {
  return {
    id:                  company.id,
    name:                company.name,
    slug:                company.slug,
    phone:               company.phone,
    address:             company.address,
    status:              company.status,
    plan:                { name: company.plan.name, tier: company.plan.tier },
    tier_key:            company.plan.tier,
    billing_cycle:       company.billing_cycle,
    subscription_status: company.status,
    trial_ends_at:       company.trial_ends_at,
    current_period_end:  company.subscription_expires_at,
    branding:            company.branding ? serializeBranding(company.branding) : null,
  }
}

export async function getCompany(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where:   { id: companyId },
    include: { plan: true, branding: true },
  })

  return serializeCompanyDetail(company)
}

export async function updateCompany(companyId: string, data: UpdateCompanyBody) {
  let slug: string | undefined
  if (data.slug) {
    slug = slugify(data.slug)
    const existing = await prisma.company.findUnique({ where: { slug } })
    if (existing && existing.id !== companyId) {
      throw new ConflictError('Slug already taken')
    }
  }

  const company = await prisma.company.update({
    where:   { id: companyId },
    data:    {
      name:    data.name,
      slug,
      phone:   data.phone,
      address: data.address,
    },
    include: { plan: true, branding: true },
  })

  return serializeCompanyDetail(company)
}

export async function upsertBranding(companyId: string, data: UpdateBrandingBody) {
  const branding = await prisma.companyBranding.upsert({
    where:  { company_id: companyId },
    create: { company_id: companyId, ...data },
    update: data,
  })

  return serializeBranding(branding)
}

export async function getSubscription(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where:   { id: companyId },
    include: { plan: true },
  })

  return {
    tier_key:            company.plan.tier,
    plan_name:           company.plan.name,
    price_monthly:       Number(company.plan.price_monthly),
    price_annual:        Number(company.plan.price_annual),
    max_locations:       company.plan.max_locations,
    feature_flags:       company.plan.feature_flags,
    billing_cycle:       company.billing_cycle,
    subscription_status: company.status,
    trial_ends_at:       company.trial_ends_at,
    current_period_end:  company.subscription_expires_at,
  }
}

export async function getMembers(companyId: string) {
  const members = await prisma.companyMember.findMany({
    where:   { company_id: companyId, status: { not: 'inactive' } },
    include: { user: true, role: true, location_assignments: true },
    orderBy: { created_at: 'asc' },
  })

  return members.map((member) => ({
    id:         member.id,
    status:     member.status,
    invited_at: member.invited_at,
    joined_at:  member.joined_at,
    user:       {
      id:        member.user.id,
      full_name: member.user.full_name,
      email:     member.user.email,
    },
    role: {
      role_key:     member.role.name,
      display_name: humanizeRoleName(member.role.name),
    },
    location_ids: member.location_assignments.map((a) => a.location_id),
  }))
}

async function assertLocationsBelongToCompany(companyId: string, locationIds: string[]): Promise<void> {
  if (locationIds.length === 0) return
  const count = await prisma.location.count({
    where: { id: { in: locationIds }, company_id: companyId },
  })
  if (count !== locationIds.length) {
    throw new ValidationError('One or more locations do not belong to this company')
  }
}

export async function inviteMember(companyId: string, data: InviteMemberBody, actor: VenueStaffActor) {
  const role = await prisma.companyRole.findUnique({
    where: { company_id_name: { company_id: companyId, name: data.role_key } },
  })
  if (!role) {
    throw new NotFoundError('Role')
  }

  const locationIds = data.location_ids ?? []
  await assertLocationsBelongToCompany(companyId, locationIds)

  let user = await prisma.user.findUnique({ where: { email: data.email } })
  const isNewUser = !user

  if (!user) {
    const password_hash = await bcrypt.hash(randomBytes(16).toString('hex'), BCRYPT_ROUNDS)
    user = await prisma.user.create({
      data: {
        full_name:      data.email.split('@')[0] ?? data.email,
        email:          data.email,
        password_hash,
        email_verified: false,
      },
    })
  }

  const existingMember = await prisma.companyMember.findUnique({
    where: { company_id_user_id: { company_id: companyId, user_id: user.id } },
  })

  if (existingMember && existingMember.status !== 'inactive') {
    throw new ConflictError('This user is already a member of your company')
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } })

  const member = await prisma.$transaction(async (tx) => {
    const memberRecord = existingMember
      ? await tx.companyMember.update({
          where: { id: existingMember.id },
          data:  { role_id: role.id, status: 'invited', invited_at: new Date(), joined_at: null },
        })
      : await tx.companyMember.create({
          data: {
            company_id: companyId,
            user_id:    user!.id,
            role_id:    role.id,
            status:     'invited',
            invited_at: new Date(),
          },
        })

    await tx.memberLocationAssignment.deleteMany({ where: { member_id: memberRecord.id } })

    if (locationIds.length > 0) {
      await tx.memberLocationAssignment.createMany({
        data: locationIds.map((location_id) => ({ member_id: memberRecord.id, location_id })),
      })
    }

    return memberRecord
  })

  let set_password_token: string | undefined
  if (isNewUser) {
    set_password_token = randomBytes(32).toString('hex')
    await redis.set(`reset:${set_password_token}`, user.id, 'EX', RESET_TTL_SECONDS)
  }

  await addEmailJob(user.email, 'staff_invite', {
    companyName:    company.name,
    roleName:       humanizeRoleName(role.name),
    setPasswordUrl: set_password_token ? `${env.FRONTEND_URL}/set-password?token=${set_password_token}` : undefined,
  }, { companyId })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'venue_staff',
    company_id:  companyId,
    action:      'member.invited',
    entity_type: 'company_member',
    entity_id:   member.id,
    after:       { email: data.email, role: role.name },
  })

  return {
    id:           member.id,
    status:       member.status,
    user:         { id: user.id, full_name: user.full_name, email: user.email },
    role:         { role_key: role.name, display_name: humanizeRoleName(role.name) },
    location_ids: locationIds,
  }
}

export async function updateMember(companyId: string, memberId: string, data: UpdateMemberBody) {
  const member = await prisma.companyMember.findFirst({
    where:   { id: memberId, company_id: companyId },
    include: { role: true },
  })
  if (!member) {
    throw new NotFoundError('Member')
  }

  if (member.role.name === 'owner') {
    throw new ForbiddenError('Cannot modify the owner')
  }

  let roleId = member.role_id
  if (data.role_key) {
    const role = await prisma.companyRole.findUnique({
      where: { company_id_name: { company_id: companyId, name: data.role_key } },
    })
    if (!role) {
      throw new NotFoundError('Role')
    }
    roleId = role.id
  }

  if (data.location_ids) {
    await assertLocationsBelongToCompany(companyId, data.location_ids)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedMember = await tx.companyMember.update({
      where:   { id: memberId },
      data:    { role_id: roleId },
      include: { role: true, user: true, location_assignments: true },
    })

    if (data.location_ids) {
      await tx.memberLocationAssignment.deleteMany({ where: { member_id: memberId } })
      if (data.location_ids.length > 0) {
        await tx.memberLocationAssignment.createMany({
          data: data.location_ids.map((location_id) => ({ member_id: memberId, location_id })),
        })
      }
    }

    return updatedMember
  })

  const location_ids = data.location_ids ?? updated.location_assignments.map((a) => a.location_id)

  return {
    id:           updated.id,
    status:       updated.status,
    user:         { id: updated.user.id, full_name: updated.user.full_name, email: updated.user.email },
    role:         { role_key: updated.role.name, display_name: humanizeRoleName(updated.role.name) },
    location_ids,
  }
}

export async function removeMember(companyId: string, memberId: string, actor: VenueStaffActor) {
  const member = await prisma.companyMember.findFirst({
    where:   { id: memberId, company_id: companyId },
    include: { role: true },
  })
  if (!member) {
    throw new NotFoundError('Member')
  }

  if (member.role.name === 'owner') {
    throw new ForbiddenError('Cannot remove the owner')
  }

  await prisma.companyMember.update({
    where: { id: memberId },
    data:  { status: 'inactive' },
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'venue_staff',
    company_id:  companyId,
    action:      'member.removed',
    entity_type: 'company_member',
    entity_id:   memberId,
    before:      { status: member.status },
    after:       { status: 'inactive' },
  })

  return { message: 'Member removed' }
}
