import { Prisma, type Booking, type PaymentTransaction } from '@sports-booking/db'
import type {
  Actor,
  VenueStaffActor,
  CreateBookingBody,
  ListBookingsQuery,
  UploadSlipBody,
  VerifySlipBody,
} from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { env } from '../lib/env.js'
import { createAuditLog } from '../middleware/audit.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { addEmailJob } from '../jobs/email.job.js'
import { localDateTimeToUtc, addDays, formatLocalDate, formatLocalTime, getDurationMinutes } from '../lib/datetime.js'
import { resolveGatewayConfig } from './payment.service.js'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  online:        'Online payment',
  bank_transfer: 'Bank transfer',
  pay_at_venue:  'Pay at venue',
}

const ACTIVE_BOOKING_STATUSES = ['pending_payment', 'pending_verification', 'confirmed']

// ─── Serialization ──────────────────────────────────────────────────────────

export function serializeBooking(booking: Booking) {
  return {
    id:             booking.id,
    booking_ref:    booking.booking_ref,
    status:         booking.status,
    payment_method: booking.payment_method,
    total_amount:   Number(booking.total_amount),
    currency:       booking.currency,
    customer_id:    booking.customer_id,
    time_slot_id:   booking.time_slot_id,
    company_id:     booking.company_id,
    notes:          booking.notes,
    booked_by_type: booking.booked_by_type,
    booked_by_id:   booking.booked_by_id,
    created_at:     booking.created_at.toISOString(),
    updated_at:     booking.updated_at.toISOString(),
  }
}

export function serializePaymentTransaction(transaction: PaymentTransaction) {
  return {
    id:               transaction.id,
    booking_id:       transaction.booking_id,
    gateway_slug:     transaction.gateway_slug,
    amount:           Number(transaction.amount),
    currency:         transaction.currency,
    status:           transaction.status,
    gateway_order_id: transaction.gateway_order_id,
    paid_at:          transaction.paid_at?.toISOString() ?? null,
    created_at:       transaction.created_at.toISOString(),
  }
}

export function serializeTimeSlotSummary(timeSlot: {
  id: string
  start_time: Date
  end_time: Date
  sub_venue: { id: string; name: string; sport_type: string; location: { id: string; name: string } }
}) {
  return {
    id:           timeSlot.id,
    start_time:   timeSlot.start_time.toISOString(),
    end_time:     timeSlot.end_time.toISOString(),
    sub_venue_id: timeSlot.sub_venue.id,
    sub_venue_name: timeSlot.sub_venue.name,
    sport_type:   timeSlot.sub_venue.sport_type,
    location_id:  timeSlot.sub_venue.location.id,
    location_name: timeSlot.sub_venue.location.name,
  }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

export async function logStatusChange(
  tx: Prisma.TransactionClient,
  bookingId: string,
  fromStatus: string | null,
  toStatus: string,
  changedBy: string | null,
  reason?: string,
): Promise<void> {
  await tx.bookingStatusLog.create({
    data: {
      booking_id:  bookingId,
      from_status: fromStatus,
      to_status:   toStatus,
      changed_by:  changedBy,
      reason:      reason ?? null,
    },
  })
}

export function assertVenueAccess(actor: VenueStaffActor, locationId: string): void {
  if (actor.location_ids.length > 0 && !actor.location_ids.includes(locationId)) {
    throw new ForbiddenError('You do not have access to this location')
  }
}

// ─── Email context ──────────────────────────────────────────────────────────

export async function buildBookingEmailContext(bookingId: string): Promise<Record<string, unknown>> {
  const booking = await prisma.booking.findUniqueOrThrow({
    where:   { id: bookingId },
    include: {
      customer:  true,
      time_slot: {
        include: {
          sub_venue: {
            include: {
              location: {
                include: {
                  company: { include: { branding: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const { sub_venue: subVenue } = booking.time_slot
  const { location } = subVenue
  const { company } = location
  const branding = company.branding

  const context: Record<string, unknown> = {
    customerName:  booking.customer.full_name,
    bookingRef:    booking.booking_ref,
    venueName:     location.name,
    subVenueName:  subVenue.name,
    date:          formatLocalDate(booking.time_slot.start_time),
    time:          formatLocalTime(booking.time_slot.start_time),
    duration:      `${getDurationMinutes(booking.time_slot.start_time, booking.time_slot.end_time)} min`,
    amount:        Number(booking.total_amount).toFixed(2),
    currency:      booking.currency,
    paymentMethod: PAYMENT_METHOD_LABELS[booking.payment_method ?? ''] ?? booking.payment_method ?? '',
    venueAddress:  location.address ?? '',
  }

  if (branding?.primary_color) {
    context.primaryColor = branding.primary_color
  }
  if (branding?.logo_url) {
    context.logoUrl = branding.logo_url
  }

  return context
}

async function loadOwnedBooking(bookingId: string, actor: Actor) {
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
  } else if (actor.type === 'venue_staff') {
    if (booking.company_id !== actor.company_id) {
      throw new NotFoundError('Booking')
    }
    assertVenueAccess(actor, booking.time_slot.sub_venue.location_id)
  }
  // platform_admin: no scoping

  return booking
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createBooking(actor: Actor, data: CreateBookingBody) {
  if (actor.type === 'platform_admin') {
    throw new ForbiddenError('Platform admins cannot create bookings')
  }

  const lockKey = `slot:lock:${data.slot_id}`
  const storedToken = await redis.get(lockKey)
  if (!storedToken || storedToken !== data.lock_token) {
    throw new ConflictError('Slot lock expired or invalid')
  }

  let customerId: string
  let customerEmail: string | null

  if (actor.type === 'player') {
    const customer = await prisma.customer.findUnique({ where: { id: actor.sub } })
    if (!customer) {
      throw new NotFoundError('Customer')
    }
    customerId    = customer.id
    customerEmail = customer.email
  } else {
    if (!data.customer_info) {
      throw new ValidationError('customer_info is required when staff create a booking')
    }
    const existing = await prisma.customer.findFirst({
      where: { company_id: actor.company_id, email: data.customer_info.email },
    })
    const customer =
      existing ??
      (await prisma.customer.create({
        data: {
          company_id: actor.company_id,
          full_name:  data.customer_info.full_name,
          email:      data.customer_info.email,
          phone:      data.customer_info.phone,
          status:     'active',
        },
      }))
    customerId    = customer.id
    customerEmail = data.customer_info.email
  }

  const bookingRef = 'BK' + Date.now().toString(36).toUpperCase()

  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      {
        id:           string
        status:       string
        lock_token:   string | null
        locked_until: Date | null
        sub_venue_id: string
        company_id:   string
        price:        Prisma.Decimal
      }[]
    >`SELECT id, status, lock_token, locked_until, sub_venue_id, company_id, price
      FROM time_slots WHERE id = ${data.slot_id}::uuid FOR UPDATE`

    const slot = rows[0]
    const now = new Date()
    if (
      !slot ||
      slot.status !== 'available' ||
      slot.lock_token !== data.lock_token ||
      !slot.locked_until ||
      slot.locked_until < now
    ) {
      throw new ConflictError('Slot lock expired or invalid')
    }

    const isPayLater = data.payment_method === 'online' || data.payment_method === 'bank_transfer'
    const bookingStatus =
      data.payment_method === 'online'
        ? 'pending_payment'
        : data.payment_method === 'bank_transfer'
        ? 'pending_verification'
        : 'confirmed'
    const slotStatus = isPayLater ? 'reserved' : 'booked'

    const booking = await tx.booking.create({
      data: {
        company_id:     slot.company_id,
        customer_id:    customerId,
        time_slot_id:   slot.id,
        booking_ref:    bookingRef,
        total_amount:   slot.price,
        currency:       'LKR',
        status:         bookingStatus,
        payment_method: data.payment_method,
        notes:          data.notes,
        booked_by_type: actor.type,
        booked_by_id:   actor.sub,
      },
    })

    const gatewayConfig = await resolveGatewayConfig(slot.company_id)

    const paymentTransaction = await tx.paymentTransaction.create({
      data: {
        booking_id:              booking.id,
        company_id:              slot.company_id,
        gateway_slug:            'payhere',
        amount:                  slot.price,
        currency:                'LKR',
        status:                  'pending',
        venue_payment_config_id: gatewayConfig.venuePaymentConfigId,
      },
    })

    await tx.timeSlot.update({
      where: { id: slot.id },
      data:  { status: slotStatus, lock_token: null, locked_until: null },
    })

    await logStatusChange(tx, booking.id, null, booking.status, actor.sub)

    await createAuditLog(
      {
        actor_id:    actor.sub,
        actor_type:  actor.type,
        company_id:  slot.company_id,
        action:      'booking.created',
        entity_type: 'booking',
        entity_id:   booking.id,
        after:       { status: booking.status, total_amount: Number(booking.total_amount) },
      },
      tx,
    )

    return { booking, paymentTransaction }
  })

  await redis.del(lockKey)

  if (customerEmail) {
    const template = data.payment_method === 'pay_at_venue' ? 'booking_confirmed' : 'payment_pending'
    const context = await buildBookingEmailContext(result.booking.id)

    if (template === 'payment_pending') {
      const billing = await prisma.companyBilling.findUnique({ where: { company_id: result.booking.company_id } })
      if (billing?.bank_name && billing.bank_account_number) {
        context.bankName = billing.bank_name
        context.accountName = billing.bank_account_name ?? undefined
        context.accountNumber = billing.bank_account_number
        if (billing.bank_branch) {
          context.branchCode = billing.bank_branch
        }
      }
      context.uploadUrl = `${env.FRONTEND_URL}/bookings/${result.booking.id}/confirmation`
    }

    await addEmailJob(customerEmail, template, context, {
      companyId: result.booking.company_id,
      bookingId: result.booking.id,
    })
  }

  return {
    booking:             serializeBooking(result.booking),
    payment_transaction: serializePaymentTransaction(result.paymentTransaction),
  }
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function getBooking(bookingId: string, actor: Actor) {
  const booking = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: {
      time_slot: { include: { sub_venue: { include: { location: true } } } },
      payment_transactions: { include: { bank_verifications: true } },
      status_log: { orderBy: { created_at: 'asc' } },
      customer: true,
    },
  })
  if (!booking) {
    throw new NotFoundError('Booking')
  }

  if (actor.type === 'player') {
    if (booking.customer_id !== actor.sub) {
      throw new NotFoundError('Booking')
    }
  } else if (actor.type === 'venue_staff') {
    if (booking.company_id !== actor.company_id) {
      throw new NotFoundError('Booking')
    }
    assertVenueAccess(actor, booking.time_slot.sub_venue.location_id)
  }

  return {
    ...serializeBooking(booking),
    time_slot: serializeTimeSlotSummary(booking.time_slot),
    customer: {
      id:        booking.customer.id,
      full_name: booking.customer.full_name,
      email:     booking.customer.email,
      phone:     booking.customer.phone,
    },
    payment_transactions: booking.payment_transactions.map((transaction) => ({
      ...serializePaymentTransaction(transaction),
      bank_verifications: transaction.bank_verifications.map((v) => ({
        id:                v.id,
        slip_image_url:    v.slip_image_url,
        bank_name:         v.bank_name,
        transfer_ref:      v.transfer_ref,
        status:            v.status,
        rejection_reason:  v.rejection_reason,
        reviewed_by:       v.reviewed_by,
        reviewed_at:       v.reviewed_at?.toISOString() ?? null,
        created_at:        v.created_at.toISOString(),
      })),
    })),
    status_log: booking.status_log.map((log) => ({
      id:          log.id,
      from_status: log.from_status,
      to_status:   log.to_status,
      changed_by:  log.changed_by,
      reason:      log.reason,
      created_at:  log.created_at.toISOString(),
    })),
  }
}

export async function listBookings(actor: Actor, filters: ListBookingsQuery) {
  const where: Prisma.BookingWhereInput = {}
  const timeSlotWhere: Prisma.TimeSlotWhereInput = {}

  if (actor.type === 'player') {
    where.customer_id = actor.sub
  } else if (actor.type === 'venue_staff') {
    where.company_id = actor.company_id

    if (filters.location_id) {
      assertVenueAccess(actor, filters.location_id)
      timeSlotWhere.sub_venue = { location_id: filters.location_id }
    } else if (actor.location_ids.length > 0) {
      timeSlotWhere.sub_venue = { location_id: { in: actor.location_ids } }
    }
  } else if (filters.location_id) {
    timeSlotWhere.sub_venue = { location_id: filters.location_id }
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.from_date || filters.to_date) {
    const startTime: Prisma.DateTimeFilter = {}
    if (filters.from_date) {
      startTime.gte = localDateTimeToUtc(filters.from_date, 0)
    }
    if (filters.to_date) {
      startTime.lt = localDateTimeToUtc(addDays(filters.to_date, 1), 0)
    }
    timeSlotWhere.start_time = startTime
  }

  if (Object.keys(timeSlotWhere).length > 0) {
    where.time_slot = timeSlotWhere
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        time_slot: { include: { sub_venue: { include: { location: true } } } },
        customer:  { select: { full_name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      skip:    (filters.page - 1) * filters.limit,
      take:    filters.limit,
    }),
    prisma.booking.count({ where }),
  ])

  return {
    data: bookings.map((booking) => ({
      ...serializeBooking(booking),
      time_slot: serializeTimeSlotSummary(booking.time_slot),
      customer:  { full_name: booking.customer.full_name, email: booking.customer.email },
    })),
    meta: { page: filters.page, limit: filters.limit, total },
  }
}

export async function getBookingStatusLog(bookingId: string, actor: Actor) {
  const booking = await loadOwnedBooking(bookingId, actor)
  const log = await prisma.bookingStatusLog.findMany({
    where:   { booking_id: booking.id },
    orderBy: { created_at: 'asc' },
  })

  return log.map((entry) => ({
    id:          entry.id,
    from_status: entry.from_status,
    to_status:   entry.to_status,
    changed_by:  entry.changed_by,
    reason:      entry.reason,
    created_at:  entry.created_at.toISOString(),
  }))
}

// ─── State transitions ──────────────────────────────────────────────────────

export async function cancelBooking(bookingId: string, actor: Actor, reason?: string) {
  const booking = await loadOwnedBooking(bookingId, actor)

  if (actor.type === 'venue_staff' && !actor.permissions.includes('bookings.cancel')) {
    throw new ForbiddenError('Missing permission: bookings.cancel')
  }
  if (actor.type === 'platform_admin') {
    throw new ForbiddenError('Platform admins cannot cancel bookings')
  }

  if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
    throw new ConflictError('Booking cannot be cancelled in its current state')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data:  { status: 'cancelled' },
    })
    await tx.paymentTransaction.updateMany({
      where: { booking_id: bookingId },
      data:  { status: 'cancelled' },
    })
    await tx.timeSlot.update({
      where: { id: booking.time_slot_id },
      data:  { status: 'available', lock_token: null, locked_until: null },
    })
    await logStatusChange(tx, bookingId, booking.status, 'cancelled', actor.sub, reason)

    await createAuditLog(
      {
        actor_id:    actor.sub,
        actor_type:  actor.type,
        company_id:  booking.company_id,
        action:      'booking.cancelled',
        entity_type: 'booking',
        entity_id:   bookingId,
        before:      { status: booking.status },
        after:       { status: 'cancelled' },
      },
      tx,
    )

    return updatedBooking
  })

  if (booking.customer.email) {
    await addEmailJob(booking.customer.email, 'booking_cancelled', await buildBookingEmailContext(bookingId), {
      companyId: booking.company_id,
      bookingId: booking.id,
    })
  }

  return serializeBooking(updated)
}

export async function checkIn(bookingId: string, actor: VenueStaffActor) {
  const booking = await loadOwnedBooking(bookingId, actor)

  if (booking.status !== 'confirmed') {
    throw new ConflictError('Booking must be confirmed to check in')
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data:  { status: 'checked_in' },
    })
    await logStatusChange(tx, bookingId, 'confirmed', 'checked_in', actor.sub)
    return updatedBooking
  })

  return serializeBooking(updated)
}

export async function markPaid(bookingId: string, actor: VenueStaffActor) {
  const booking = await loadOwnedBooking(bookingId, actor)

  if (booking.payment_method !== 'pay_at_venue') {
    throw new ConflictError('Booking payment method is not pay_at_venue')
  }
  if (booking.status !== 'confirmed') {
    throw new ConflictError('Booking must be confirmed')
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.updateMany({
      where: { booking_id: bookingId },
      data:  { status: 'paid', paid_at: new Date() },
    })
    await tx.timeSlot.update({
      where: { id: booking.time_slot_id },
      data:  { status: 'booked' },
    })
    await logStatusChange(tx, bookingId, 'confirmed', 'confirmed', actor.sub, 'Marked as paid (pay at venue)')
  })

  return serializeBooking(booking)
}

// ─── Bank transfer slip flow ────────────────────────────────────────────────

export async function uploadSlip(bookingId: string, actor: Actor, data: UploadSlipBody) {
  if (actor.type === 'platform_admin') {
    throw new ForbiddenError('Platform admins cannot upload payment slips')
  }

  const booking = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: { time_slot: { include: { sub_venue: true } }, payment_transactions: true },
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

  if (booking.payment_method !== 'bank_transfer') {
    throw new ConflictError('Booking payment method is not bank_transfer')
  }
  if (booking.status !== 'pending_verification') {
    throw new ConflictError('Booking is not awaiting payment verification')
  }

  const transaction = booking.payment_transactions[0]
  if (!transaction) {
    throw new NotFoundError('Payment transaction')
  }

  const verification = await prisma.bankTransferVerification.create({
    data: {
      transaction_id: transaction.id,
      company_id:     booking.company_id,
      slip_image_url: data.slip_image_url,
      bank_name:      data.bank_name,
      transfer_ref:   data.transfer_ref,
      status:         'pending',
    },
  })

  const locationId = booking.time_slot.sub_venue.location_id
  const members = await prisma.companyMember.findMany({
    where: {
      company_id: booking.company_id,
      status:     'active',
      role: { permissions: { some: { permission: { key: 'payments.verify_slip' } } } },
      OR: [
        { location_assignments: { some: { location_id: locationId } } },
        { location_assignments: { none: {} } },
      ],
    },
    select: { user_id: true },
  })

  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map((member) => ({
        company_id: booking.company_id,
        user_id:    member.user_id,
        type:       'slip_uploaded',
        title:      'Bank transfer slip uploaded',
        body:       `Booking ${booking.booking_ref} is awaiting payment verification`,
        data:       { booking_id: booking.id } as Prisma.InputJsonValue,
      })),
    })
  }

  return {
    id:             verification.id,
    transaction_id: verification.transaction_id,
    slip_image_url: verification.slip_image_url,
    bank_name:      verification.bank_name,
    transfer_ref:   verification.transfer_ref,
    status:         verification.status,
    created_at:     verification.created_at.toISOString(),
  }
}

export async function verifySlip(bookingId: string, actor: VenueStaffActor, decision: VerifySlipBody) {
  const booking = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: {
      time_slot: { include: { sub_venue: true } },
      customer:  true,
      payment_transactions: {
        include: { bank_verifications: { orderBy: { created_at: 'desc' }, take: 1 } },
      },
    },
  })
  if (!booking || booking.company_id !== actor.company_id) {
    throw new NotFoundError('Booking')
  }
  assertVenueAccess(actor, booking.time_slot.sub_venue.location_id)

  if (booking.status !== 'pending_verification') {
    throw new ConflictError('Booking is not awaiting payment verification')
  }

  const transaction = booking.payment_transactions[0]
  const verification = transaction?.bank_verifications[0]
  if (!transaction || !verification || verification.status !== 'pending') {
    throw new NotFoundError('Pending bank transfer verification')
  }

  if (decision.approved) {
    await prisma.$transaction(async (tx) => {
      await tx.bankTransferVerification.update({
        where: { id: verification.id },
        data:  { status: 'approved', reviewed_by: actor.sub, reviewed_at: new Date() },
      })
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data:  { status: 'paid', paid_at: new Date() },
      })
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'confirmed' } })
      await tx.timeSlot.update({ where: { id: booking.time_slot_id }, data: { status: 'booked' } })
      await logStatusChange(tx, bookingId, 'pending_verification', 'confirmed', actor.sub)

      await createAuditLog(
        {
          actor_id:    actor.sub,
          actor_type:  actor.type,
          company_id:  booking.company_id,
          action:      'payment.verified',
          entity_type: 'payment_transaction',
          entity_id:   transaction.id,
          before:      { status: 'pending' },
          after:       { status: 'paid' },
        },
        tx,
      )
    })

    if (booking.customer.email) {
      await addEmailJob(booking.customer.email, 'slip_approved', await buildBookingEmailContext(bookingId), {
        companyId: booking.company_id,
        bookingId: booking.id,
      })
    }
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.bankTransferVerification.update({
        where: { id: verification.id },
        data: {
          status:            'rejected',
          rejection_reason:  decision.rejection_reason,
          reviewed_by:       actor.sub,
          reviewed_at:       new Date(),
        },
      })
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'cancelled' } })
      await tx.timeSlot.update({
        where: { id: booking.time_slot_id },
        data:  { status: 'available', lock_token: null, locked_until: null },
      })
      await logStatusChange(tx, bookingId, 'pending_verification', 'cancelled', actor.sub, decision.rejection_reason)

      await createAuditLog(
        {
          actor_id:    actor.sub,
          actor_type:  actor.type,
          company_id:  booking.company_id,
          action:      'payment.rejected',
          entity_type: 'payment_transaction',
          entity_id:   transaction.id,
          after:       { status: 'rejected', reason: decision.rejection_reason },
        },
        tx,
      )
    })

    if (booking.customer.email) {
      await addEmailJob(
        booking.customer.email,
        'slip_rejected',
        { ...(await buildBookingEmailContext(bookingId)), rejectionReason: decision.rejection_reason },
        { companyId: booking.company_id, bookingId: booking.id },
      )
    }
  }

  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })
  return serializeBooking(updated)
}
