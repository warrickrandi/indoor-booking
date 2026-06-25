import dns from 'node:dns'
import type { EmailConfigMode, UpdateEmailConfigBody, VenueStaffActor } from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { encrypt } from '../lib/encrypt.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { TIER_RANK } from '../middleware/rbac.js'
import { addEmailJob } from '../jobs/email.job.js'
import { createAuditLog } from '../middleware/audit.js'
import { generateDkimKeyPair, buildDkimRecordHostname, buildDkimDnsRecordValue } from '../lib/dkim.js'

const MASKED_SECRET = '••••••••••••••••'

const MODE_MIN_TIER: Record<EmailConfigMode, string> = {
  platform:      'basic',
  subdomain:     'pro',
  custom_domain: 'elite',
  custom_smtp:   'elite',
}

export interface EmailConfigResponse {
  configured:      boolean
  mode:            string
  from_name:       string | null
  from_address:    string | null
  reply_to:        string | null
  smtp_host:       string | null
  smtp_port:       number | null
  smtp_user:       string | null
  smtp_password:   string | null
  smtp_encryption: string
  dkim_selector:   string | null
  dkim_configured: boolean
  spf_verified:    boolean
  dkim_verified:   boolean
  dmarc_verified:  boolean
  updated_at:      string | null
}

export async function getEmailConfig(companyId: string): Promise<EmailConfigResponse> {
  const config = await prisma.companyEmailConfig.findUnique({ where: { company_id: companyId } })

  if (!config) {
    return {
      configured:      false,
      mode:            'platform',
      from_name:       null,
      from_address:    null,
      reply_to:        null,
      smtp_host:       null,
      smtp_port:       null,
      smtp_user:       null,
      smtp_password:   null,
      smtp_encryption: 'tls',
      dkim_selector:   null,
      dkim_configured: false,
      spf_verified:    false,
      dkim_verified:   false,
      dmarc_verified:  false,
      updated_at:      null,
    }
  }

  return {
    configured:      true,
    mode:            config.mode,
    from_name:       config.from_name,
    from_address:    config.from_address,
    reply_to:        config.reply_to,
    smtp_host:       config.smtp_host,
    smtp_port:       config.smtp_port,
    smtp_user:       config.smtp_user,
    smtp_password:   config.smtp_password_encrypted ? MASKED_SECRET : null,
    smtp_encryption: config.smtp_encryption,
    dkim_selector:   config.dkim_selector,
    dkim_configured: !!config.dkim_public_key,
    spf_verified:    config.spf_verified,
    dkim_verified:   config.dkim_verified,
    dmarc_verified:  config.dmarc_verified,
    updated_at:      config.updated_at.toISOString(),
  }
}

export async function updateEmailConfig(actor: VenueStaffActor, body: UpdateEmailConfigBody): Promise<EmailConfigResponse> {
  const requiredTier = MODE_MIN_TIER[body.mode]
  if ((TIER_RANK[actor.tier] ?? 0) < (TIER_RANK[requiredTier] ?? 0)) {
    throw new ForbiddenError(
      `The "${body.mode}" email mode requires a ${requiredTier} subscription or higher`,
      { required_tier: requiredTier },
    )
  }

  if ((body.mode === 'custom_domain' || body.mode === 'custom_smtp') && !body.from_address) {
    throw new ValidationError('from_address is required for this email mode')
  }
  if (body.mode === 'custom_smtp' && !body.smtp_host) {
    throw new ValidationError('smtp_host is required for custom_smtp mode')
  }

  const existing = await prisma.companyEmailConfig.findUnique({ where: { company_id: actor.company_id } })

  const verificationChanged =
    !existing ||
    existing.mode !== body.mode ||
    (existing.from_address ?? null) !== (body.from_address ?? null) ||
    (existing.dkim_selector ?? null) !== (body.dkim_selector ?? null)

  const sharedData = {
    mode:            body.mode,
    from_name:       body.from_name ?? null,
    from_address:    body.from_address ?? null,
    reply_to:        body.reply_to ?? null,
    smtp_host:       body.smtp_host ?? null,
    smtp_port:       body.smtp_port ?? null,
    smtp_user:       body.smtp_user ?? null,
    smtp_encryption: body.smtp_encryption ?? 'tls',
    dkim_selector:   body.dkim_selector ?? null,
    ...(verificationChanged ? { spf_verified: false, dkim_verified: false, dmarc_verified: false } : {}),
  }

  const smtpPasswordEncrypted = body.smtp_pass ? encrypt(body.smtp_pass) : undefined

  await prisma.companyEmailConfig.upsert({
    where:  { company_id: actor.company_id },
    create: {
      company_id: actor.company_id,
      ...sharedData,
      smtp_password_encrypted: smtpPasswordEncrypted ?? null,
    },
    update: {
      ...sharedData,
      ...(smtpPasswordEncrypted ? { smtp_password_encrypted: smtpPasswordEncrypted } : {}),
    },
  })

  return getEmailConfig(actor.company_id)
}

async function hasTxtRecordStartingWith(hostname: string, prefix: string): Promise<boolean> {
  try {
    const records = await dns.promises.resolveTxt(hostname)
    return records.some((parts) => parts.join('').startsWith(prefix))
  } catch {
    return false
  }
}

export async function verifyEmailConfigDns(actor: VenueStaffActor): Promise<EmailConfigResponse> {
  const config = await prisma.companyEmailConfig.findUnique({ where: { company_id: actor.company_id } })
  if (!config) {
    throw new NotFoundError('Email configuration')
  }

  if (config.mode === 'platform' || config.mode === 'subdomain') {
    await prisma.companyEmailConfig.update({
      where: { company_id: actor.company_id },
      data:  { spf_verified: true, dkim_verified: true, dmarc_verified: true },
    })
    return getEmailConfig(actor.company_id)
  }

  if (!config.from_address?.includes('@')) {
    throw new ValidationError('A valid from_address must be set before verifying DNS')
  }
  const domain = config.from_address.split('@')[1] as string

  const [spfVerified, dkimVerified, dmarcVerified] = await Promise.all([
    hasTxtRecordStartingWith(domain, 'v=spf1'),
    config.dkim_selector
      ? hasTxtRecordStartingWith(`${config.dkim_selector}._domainkey.${domain}`, 'v=DKIM1')
      : Promise.resolve(false),
    hasTxtRecordStartingWith(`_dmarc.${domain}`, 'v=DMARC1'),
  ])

  await prisma.companyEmailConfig.update({
    where: { company_id: actor.company_id },
    data:  { spf_verified: spfVerified, dkim_verified: dkimVerified, dmarc_verified: dmarcVerified },
  })

  return getEmailConfig(actor.company_id)
}

export async function sendTestEmail(actor: VenueStaffActor, toAddress: string): Promise<{ queued: true }> {
  await addEmailJob(toAddress, 'welcome_player', { customerName: 'Test User' }, { companyId: actor.company_id })
  return { queued: true }
}

export interface DkimSetupResponse {
  selector:        string
  public_key:      string
  dns_record_type: 'TXT'
  dns_record_host: string
  dns_record_value: string
  generated_at:    string
}

function assertCustomDomainMode(config: { mode: string; from_address: string | null } | null): { mode: string; from_address: string } {
  if (!config || (config.mode !== 'custom_domain' && config.mode !== 'custom_smtp')) {
    throw new ValidationError('DKIM requires a custom_domain or custom_smtp email mode')
  }
  if (!config.from_address?.includes('@')) {
    throw new ValidationError('A valid from_address must be set before generating DKIM keys')
  }
  return { mode: config.mode, from_address: config.from_address }
}

export async function generateDkimKeys(actor: VenueStaffActor, selector?: string): Promise<DkimSetupResponse> {
  const config = await prisma.companyEmailConfig.findUnique({ where: { company_id: actor.company_id } })
  const { from_address } = assertCustomDomainMode(config)

  const domain = from_address.split('@')[1] as string
  const dkimSelector = selector ?? config?.dkim_selector ?? 'default'

  const { privateKeyPem, publicKeyPem, dnsRecordValue } = generateDkimKeyPair()

  const updated = await prisma.companyEmailConfig.update({
    where: { company_id: actor.company_id },
    data: {
      dkim_selector:              dkimSelector,
      dkim_private_key_encrypted: encrypt(privateKeyPem),
      dkim_public_key:            publicKeyPem,
      dkim_verified:              false,
    },
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'venue_staff',
    company_id:  actor.company_id,
    action:      'email_config.dkim_generated',
    entity_type: 'company_email_config',
    entity_id:   updated.id,
    after:       { dkim_selector: dkimSelector },
  })

  return {
    selector:         dkimSelector,
    public_key:       publicKeyPem,
    dns_record_type:  'TXT',
    dns_record_host:  buildDkimRecordHostname(dkimSelector, domain),
    dns_record_value: dnsRecordValue,
    generated_at:     updated.updated_at.toISOString(),
  }
}

export async function getDkimSetup(actor: VenueStaffActor): Promise<DkimSetupResponse | { configured: false }> {
  const config = await prisma.companyEmailConfig.findUnique({ where: { company_id: actor.company_id } })

  if (!config?.dkim_public_key || !config.dkim_selector || !config.from_address?.includes('@')) {
    return { configured: false }
  }

  const domain = config.from_address.split('@')[1] as string

  return {
    selector:         config.dkim_selector,
    public_key:       config.dkim_public_key,
    dns_record_type:  'TXT',
    dns_record_host:  buildDkimRecordHostname(config.dkim_selector, domain),
    dns_record_value: buildDkimDnsRecordValue(config.dkim_public_key),
    generated_at:     config.updated_at.toISOString(),
  }
}
