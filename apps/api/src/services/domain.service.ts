import dns from 'node:dns'
import { randomBytes } from 'node:crypto'
import type { CompanyDomain } from '@sports-booking/db'
import type { VenueStaffActor } from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { env } from '../lib/env.js'
import { ConflictError, NotFoundError } from '../lib/errors.js'
import { createAuditLog } from '../middleware/audit.js'
import { addDomainToVercel, removeDomainFromVercel } from '../lib/vercel-domains.js'
import { addDomainSslCheckJob } from '../jobs/domain-ssl.job.js'

export const RESERVED_SUBDOMAINS = ['www', 'app', 'admin', 'api']

const VERIFY_TOKEN_TTL_SECONDS = 24 * 60 * 60

function verifyKey(domain: string): string {
  return `domain:verify:${domain}`
}

function serializeDomain(row: CompanyDomain) {
  return {
    id:              row.id,
    domain:          row.domain,
    type:            row.type,
    is_verified:     row.is_verified,
    ssl_provisioned: row.ssl_provisioned,
    verified_at:     row.verified_at ? row.verified_at.toISOString() : null,
    created_at:      row.created_at.toISOString(),
  }
}

export async function getDomainSettings(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where:  { id: companyId },
    select: { slug: true },
  })

  const customDomains = await prisma.companyDomain.findMany({
    where:   { company_id: companyId },
    orderBy: { created_at: 'asc' },
  })

  return {
    subdomain: {
      value: `${company.slug}.${env.PLATFORM_DOMAIN}`,
    },
    custom_domains: customDomains.map(serializeDomain),
  }
}

export async function addCustomDomain(companyId: string, domain: string, actor: VenueStaffActor) {
  const existing = await prisma.companyDomain.findUnique({ where: { domain } })
  if (existing) {
    throw new ConflictError('This domain is already in use')
  }

  const row = await prisma.companyDomain.create({
    data: {
      company_id:      companyId,
      domain,
      type:            'custom',
      is_verified:     false,
      ssl_provisioned: false,
    },
  })

  const token = randomBytes(16).toString('hex')
  await redis.set(verifyKey(domain), token, 'EX', VERIFY_TOKEN_TTL_SECONDS)

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  actor.type,
    company_id:  companyId,
    action:      'domain.added',
    entity_type: 'company_domain',
    entity_id:   row.id,
    after:       { domain },
  })

  return {
    id:     row.id,
    domain: row.domain,
    verification_records: [
      { type: 'TXT', name: '_platform-verify', value: `platform-verify=${token}` },
      { type: 'CNAME', name: '@', value: 'cname.vercel-dns.com' },
    ],
  }
}

async function getOwnedDomain(companyId: string, domainId: string): Promise<CompanyDomain> {
  const row = await prisma.companyDomain.findFirst({
    where: { id: domainId, company_id: companyId },
  })
  if (!row) {
    throw new NotFoundError('Domain')
  }
  return row
}

export async function verifyDomain(companyId: string, domainId: string, actor: VenueStaffActor) {
  const row = await getOwnedDomain(companyId, domainId)

  if (row.is_verified) {
    return { verified: true, ssl_provisioned: row.ssl_provisioned, message: 'Domain already verified.' }
  }

  const token = await redis.get(verifyKey(row.domain))
  if (!token) {
    throw new ConflictError('Verification expired — remove and re-add this domain')
  }

  let records: string[][]
  try {
    records = await dns.promises.resolveTxt(`_platform-verify.${row.domain}`)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      return { verified: false, message: 'TXT record not found yet. DNS propagation can take up to 48 hours.' }
    }
    return { verified: false, message: 'DNS lookup failed — check your DNS provider is reachable and try again.' }
  }

  const expected = `platform-verify=${token}`
  const found = records.some((parts) => parts.join('') === expected)

  if (!found) {
    return { verified: false, message: 'TXT record not found yet. DNS propagation can take up to 48 hours.' }
  }

  await prisma.companyDomain.update({
    where: { id: row.id },
    data:  { is_verified: true, verified_at: new Date() },
  })

  await addDomainToVercel(row.domain)
  await addDomainSslCheckJob({ domainId: row.id, domain: row.domain, companyId })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  actor.type,
    company_id:  companyId,
    action:      'domain.verified',
    entity_type: 'company_domain',
    entity_id:   row.id,
    before:      { is_verified: false },
    after:       { is_verified: true },
  })

  return {
    verified:        true,
    ssl_provisioned: false,
    message:         'Domain verified. SSL provisioning started — this can take a few minutes.',
  }
}

export async function removeDomain(companyId: string, domainId: string, actor: VenueStaffActor) {
  const row = await getOwnedDomain(companyId, domainId)

  await removeDomainFromVercel(row.domain)
  await redis.del(verifyKey(row.domain))
  await prisma.companyDomain.delete({ where: { id: row.id } })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  actor.type,
    company_id:  companyId,
    action:      'domain.removed',
    entity_type: 'company_domain',
    entity_id:   row.id,
    before:      { domain: row.domain },
  })

  return { message: 'Domain removed' }
}
