import { Prisma } from '@sports-booking/db'
import type {
  Actor,
  VenueStaffActor,
  ListTransactionsQuery,
  GatewayConfigBody,
} from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { env } from '../lib/env.js'
import { encrypt, decrypt } from '../lib/encrypt.js'
import { createAuditLog } from '../middleware/audit.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { addEmailJob } from '../jobs/email.job.js'
import { localDateTimeToUtc, addDays } from '../lib/datetime.js'
import { assertVenueAccess, buildBookingEmailContext, logStatusChange, serializePaymentTransaction } from './booking.service.js'
import { getGatewayDriver } from './gateways/registry.js'
import type { DriverConfig, GatewayDriver, WebhookStatus } from './gateways/types.js'

const MASKED_SECRET = '••••••••••••••••'

const REQUIRED_CREDENTIAL_KEYS: Record<string, string[]> = {
  payhere:   ['merchant_id', 'merchant_secret'],
  webxpay:   [],
  directpay: [],
}

export interface ResolvedGatewayConfig {
  slug:                 string
  driver:               GatewayDriver
  config:               DriverConfig
  venuePaymentConfigId: string | null
  isPlatformMaster:     boolean
}

export interface GatewaySummary {
  slug:                   string
  name:                   string
  is_active:              boolean
  is_stub:                boolean
  configured:             boolean
  is_venue_config_active: boolean
}

export interface GatewayConfigResponse {
  configured:    boolean
  gateway_slug:  string
  is_active?:    boolean
  credentials?:  Record<string, string>
  updated_at?:   string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSecretKey(key: string): boolean {
  return /secret|password|key/i.test(key)
}

function maskStart(value: string): string {
  return `${value.slice(0, 4)}****`
}

/**
 * Legacy stored configs are a flat `{merchant_id, merchant_secret, ...}` object.
 * New configs are `{credentials: {...}}`. Treat the flat shape as the
 * credentials object itself — self-heals to the new shape on next save.
 */
function normalizeCredentials(configEncrypted: string): Record<string, string> {
  const parsed = JSON.parse(decrypt(configEncrypted)) as Record<string, unknown>
  return (parsed['credentials'] ?? parsed) as Record<string, string>
}

// ─── Gateway config resolution ──────────────────────────────────────────────

export async function resolveGatewayConfig(companyId: string, slug?: string): Promise<ResolvedGatewayConfig> {
  let resolvedSlug = slug
  if (!resolvedSlug) {
    const activeConfig = await prisma.venuePaymentConfig.findFirst({
      where:   { company_id: companyId, is_active: true },
      include: { gateway: true },
    })
    resolvedSlug = activeConfig?.gateway.slug ?? 'payhere'
  }

  const driver = getGatewayDriver(resolvedSlug)
  if (!driver) {
    throw new NotFoundError('Gateway driver')
  }

  const gatewayDriverRow = await prisma.gatewayDriver.findUnique({ where: { slug: resolvedSlug } })
  if (gatewayDriverRow) {
    const config = await prisma.venuePaymentConfig.findFirst({
      where: { company_id: companyId, gateway_id: gatewayDriverRow.id, is_active: true },
    })
    if (config) {
      return {
        slug:                 resolvedSlug,
        driver,
        config:               { credentials: normalizeCredentials(config.config_encrypted) },
        venuePaymentConfigId: config.id,
        isPlatformMaster:     false,
      }
    }
  }

  if (resolvedSlug === 'payhere') {
    return {
      slug:                 'payhere',
      driver,
      config:               { credentials: { merchant_id: env.PAYHERE_MERCHANT_ID, merchant_secret: env.PAYHERE_SECRET } },
      venuePaymentConfigId: null,
      isPlatformMaster:     true,
    }
  }

  throw new ConflictError('No payment gateway configuration found for this venue')
}

export async function listAvailableGateways(actor: VenueStaffActor): Promise<GatewaySummary[]> {
  const drivers = await prisma.gatewayDriver.findMany({ orderBy: { created_at: 'asc' } })

  const venueConfigs = await prisma.venuePaymentConfig.findMany({
    where: { company_id: actor.company_id, gateway_id: { in: drivers.map((d) => d.id) } },
  })
  const configByGatewayId = new Map(venueConfigs.map((c) => [c.gateway_id, c]))

  return drivers.map((driver) => {
    const config = configByGatewayId.get(driver.id)
    return {
      slug:                   driver.slug,
      name:                   driver.name,
      is_active:              driver.is_active,
      is_stub:                getGatewayDriver(driver.slug)?.isStub ?? false,
      configured:             !!config,
      is_venue_config_active: config?.is_active ?? false,
    }
  })
}

export async function getGatewayConfig(actor: VenueStaffActor, slug: string): Promise<GatewayConfigResponse> {
  const gatewayDriverRow = await prisma.gatewayDriver.findUnique({ where: { slug } })
  if (!gatewayDriverRow) {
    throw new NotFoundError('Gateway driver')
  }

  const config = await prisma.venuePaymentConfig.findUnique({
    where: { company_id_gateway_id: { company_id: actor.company_id, gateway_id: gatewayDriverRow.id } },
  })

  if (!config) {
    return { configured: false, gateway_slug: slug }
  }

  const credentials = normalizeCredentials(config.config_encrypted)
  const maskedCredentials: Record<string, string> = {}
  for (const [key, value] of Object.entries(credentials)) {
    maskedCredentials[key] = isSecretKey(key) ? MASKED_SECRET : maskStart(value)
  }

  return {
    configured:   true,
    gateway_slug: slug,
    is_active:    config.is_active,
    credentials:  maskedCredentials,
    updated_at:   config.updated_at.toISOString(),
  }
}

export async function updateGatewayConfig(
  actor: VenueStaffActor,
  slug: string,
  data: GatewayConfigBody,
): Promise<GatewayConfigResponse> {
  const gatewayDriverRow = await prisma.gatewayDriver.findUnique({ where: { slug } })
  if (!gatewayDriverRow) {
    throw new NotFoundError('Gateway driver')
  }
  if (!gatewayDriverRow.is_active) {
    throw new ConflictError('This payment gateway is not currently available')
  }

  const requiredKeys = REQUIRED_CREDENTIAL_KEYS[slug] ?? []
  const missingKeys = requiredKeys.filter((key) => !data.credentials[key])
  if (missingKeys.length > 0) {
    throw new ValidationError(`Missing required credential field(s): ${missingKeys.join(', ')}`)
  }

  const configEncrypted = encrypt(JSON.stringify({ credentials: data.credentials }))

  const config = await prisma.$transaction(async (tx) => {
    await tx.venuePaymentConfig.updateMany({
      where: { company_id: actor.company_id, gateway_id: { not: gatewayDriverRow.id } },
      data:  { is_active: false },
    })

    return tx.venuePaymentConfig.upsert({
      where:  { company_id_gateway_id: { company_id: actor.company_id, gateway_id: gatewayDriverRow.id } },
      create: { company_id: actor.company_id, gateway_id: gatewayDriverRow.id, config_encrypted: configEncrypted, is_active: true },
      update: { config_encrypted: configEncrypted, is_active: true },
    })
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'venue_staff',
    company_id:  actor.company_id,
    action:      'gateway_config.updated',
    entity_type: 'venue_payment_config',
    entity_id:   config.id,
    after:       { gateway_slug: slug },
  })

  return getGatewayConfig(actor, slug)
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export async function initiatePayment(actor: Actor, bookingId: string) {
  if (actor.type === 'platform_admin') {
    throw new ForbiddenError('Platform admins cannot initiate payments')
  }

  const booking = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { time_slot: { include: { sub_venue: true } }, customer: true },
  })
  if (!booking) {
    throw new NotFoundError('Booking')
  }

  if (actor.type === 'player') {
    if (booking.customer_id !== actor.sub) {
      throw new NotFoundError('Booking')
    }
  } else {
    if (booking.company_id !== actor.company_id) {
      throw new NotFoundError('Booking')
    }
    assertVenueAccess(actor, booking.time_slot.sub_venue.location_id)
  }

  if (booking.payment_method !== 'online' || booking.status !== 'pending_payment') {
    throw new ConflictError('Booking is not awaiting online payment')
  }

  const gatewayConfig = await resolveGatewayConfig(booking.company_id)

  return {
    checkout_url:    gatewayConfig.driver.getCheckoutUrl(),
    checkout_params: gatewayConfig.driver.buildCheckoutPayload(booking, gatewayConfig.config),
    gateway_slug:    gatewayConfig.slug,
  }
}

// ─── Webhook dispatch ────────────────────────────────────────────────────────

export async function processWebhookPayment(
  bookingId: string,
  webhookStatus: WebhookStatus,
  gatewayOrderId: string | null,
  gatewayResponse: Record<string, unknown>,
  gatewaySlug: string,
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { payment_transactions: true, customer: true },
  })
  if (!booking) {
    return
  }

  const transaction = booking.payment_transactions[0]
  if (!transaction || booking.payment_method !== 'online' || booking.status !== 'pending_payment') {
    return
  }

  if (webhookStatus === 'paid') {
    await prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status:           'paid',
          gateway_slug:     gatewaySlug,
          gateway_order_id: gatewayOrderId,
          gateway_response: gatewayResponse as Prisma.InputJsonValue,
          paid_at:          new Date(),
        },
      })
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'confirmed' } })
      await tx.timeSlot.update({ where: { id: booking.time_slot_id }, data: { status: 'booked' } })
      await logStatusChange(tx, bookingId, 'pending_payment', 'confirmed', null, `${gatewaySlug} payment confirmed`)
    })

    if (booking.customer.email) {
      await addEmailJob(booking.customer.email, 'booking_confirmed', await buildBookingEmailContext(bookingId), {
        companyId: booking.company_id,
        bookingId: booking.id,
      })
    }
  } else if (webhookStatus === 'pending') {
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status:           'pending',
        gateway_slug:     gatewaySlug,
        gateway_order_id: gatewayOrderId,
        gateway_response: gatewayResponse as Prisma.InputJsonValue,
      },
    })
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status:           'failed',
          gateway_slug:     gatewaySlug,
          gateway_order_id: gatewayOrderId,
          gateway_response: gatewayResponse as Prisma.InputJsonValue,
        },
      })
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'cancelled' } })
      await tx.timeSlot.update({
        where: { id: booking.time_slot_id },
        data:  { status: 'available', lock_token: null, locked_until: null },
      })
      await logStatusChange(tx, bookingId, 'pending_payment', 'cancelled', null, `${gatewaySlug} payment failed`)
    })

    if (booking.customer.email) {
      await addEmailJob(booking.customer.email, 'booking_cancelled', await buildBookingEmailContext(bookingId), {
        companyId: booking.company_id,
        bookingId: booking.id,
      })
    }
  }
}

export async function handleGatewayWebhook(slug: string, payload: Record<string, string>): Promise<void> {
  const driver = getGatewayDriver(slug)
  if (!driver) {
    console.warn(`[gateway webhook] unknown driver slug "${slug}" — ignoring`)
    return
  }

  const { bookingId, gatewayOrderId } = driver.extractWebhookIds(payload)
  if (!bookingId) {
    return
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking) {
    return
  }

  let gatewayConfig: ResolvedGatewayConfig
  try {
    gatewayConfig = await resolveGatewayConfig(booking.company_id, slug)
  } catch (err) {
    console.warn(`[gateway webhook:${slug}] could not resolve config for booking ${bookingId}:`, err)
    return
  }

  if (!driver.verifyWebhook(payload, gatewayConfig.config)) {
    console.warn(`[gateway webhook:${slug}] signature verification failed for booking ${bookingId}`)
    return
  }

  await processWebhookPayment(bookingId, driver.parseWebhookStatus(payload), gatewayOrderId, payload, slug)
}

// ─── Transaction listing ─────────────────────────────────────────────────────

export async function listTransactions(actor: Actor, filters: ListTransactionsQuery) {
  if (actor.type === 'player') {
    throw new ForbiddenError('Players cannot view transactions')
  }

  const where: Prisma.PaymentTransactionWhereInput = {}
  const timeSlotFilter: Prisma.TimeSlotWhereInput = {}

  if (actor.type === 'venue_staff') {
    where.company_id = actor.company_id

    if (filters.location_id) {
      assertVenueAccess(actor, filters.location_id)
      timeSlotFilter.sub_venue = { location_id: filters.location_id }
    } else if (actor.location_ids.length > 0) {
      timeSlotFilter.sub_venue = { location_id: { in: actor.location_ids } }
    }
  } else if (filters.location_id) {
    timeSlotFilter.sub_venue = { location_id: filters.location_id }
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.from_date || filters.to_date) {
    const createdAt: Prisma.DateTimeFilter = {}
    if (filters.from_date) {
      createdAt.gte = localDateTimeToUtc(filters.from_date, 0)
    }
    if (filters.to_date) {
      createdAt.lt = localDateTimeToUtc(addDays(filters.to_date, 1), 0)
    }
    where.created_at = createdAt
  }

  if (Object.keys(timeSlotFilter).length > 0) {
    where.booking = { time_slot: timeSlotFilter }
  }

  const [transactions, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where,
      include: { booking: true },
      orderBy: { created_at: 'desc' },
      skip:    (filters.page - 1) * filters.limit,
      take:    filters.limit,
    }),
    prisma.paymentTransaction.count({ where }),
  ])

  return {
    data: transactions.map((transaction) => ({
      ...serializePaymentTransaction(transaction),
      booking_ref: transaction.booking.booking_ref,
    })),
    meta: { page: filters.page, limit: filters.limit, total },
  }
}

export async function getTransaction(actor: Actor, transactionId: string) {
  if (actor.type === 'player') {
    throw new ForbiddenError('Players cannot view transactions')
  }

  const transaction = await prisma.paymentTransaction.findUnique({
    where:   { id: transactionId },
    include: {
      booking:            { include: { time_slot: { include: { sub_venue: true } } } },
      bank_verifications: true,
    },
  })
  if (!transaction) {
    throw new NotFoundError('Transaction')
  }

  let isOwner = actor.type === 'platform_admin'
  if (actor.type === 'venue_staff') {
    if (transaction.company_id !== actor.company_id) {
      throw new NotFoundError('Transaction')
    }
    assertVenueAccess(actor, transaction.booking.time_slot.sub_venue.location_id)
    isOwner = actor.location_ids.length === 0
  }

  return {
    ...serializePaymentTransaction(transaction),
    booking_ref: transaction.booking.booking_ref,
    ...(isOwner ? { gateway_response: transaction.gateway_response } : {}),
    bank_verifications: transaction.bank_verifications.map((v) => ({
      id:               v.id,
      slip_image_url:   v.slip_image_url,
      bank_name:        v.bank_name,
      transfer_ref:     v.transfer_ref,
      status:           v.status,
      rejection_reason: v.rejection_reason,
      reviewed_by:      v.reviewed_by,
      reviewed_at:      v.reviewed_at?.toISOString() ?? null,
      created_at:       v.created_at.toISOString(),
    })),
  }
}
