import { Prisma } from '@sports-booking/db'
import {
  recurringTimeToMinutes,
  type Actor,
  type VenueStaffActor,
  type PlayerActor,
  type CreateRecurringRequestBody,
  type ListRecurringRequestsQuery,
  type ApproveRecurringRequestBody,
  type RejectRecurringRequestBody,
  type CancelRecurringRequestBody,
} from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { createAuditLog } from '../middleware/audit.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import { addDays, getDayOfWeek, getTodayLocalDateString, localDateTimeToUtc } from '../lib/datetime.js'
import { assertVenueAccess, logStatusChange, serializeBooking, serializeTimeSlotSummary } from './booking.service.js'
import { generateSlotsForDate } from './slot.service.js'

const ACTIVE_BOOKING_STATUSES = ['pending_payment', 'pending_verification', 'confirmed']

const requestInclude = {
  sub_venue: { include: { location: true } },
  customer:  true,
  _count:    { select: { bookings: true } },
} satisfies Prisma.RecurringBookingRequestInclude

type RequestWithRelations = Prisma.RecurringBookingRequestGetPayload<{ include: typeof requestInclude }>

type OccurrenceStatus = 'available' | 'conflict' | 'no_matching_slots' | 'not_generated'

interface Occurrence {
  date: string
  status: OccurrenceStatus
  reason?: string
  slot_ids: string[]
  amount: number
}

// ─── Serialization ──────────────────────────────────────────────────────────

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function serializeRequest(request: RequestWithRelations) {
  return {
    id:             request.id,
    company_id:     request.company_id,
    location_id:    request.location_id,
    location_name:  request.sub_venue.location.name,
    sub_venue_id:   request.sub_venue_id,
    sub_venue_name: request.sub_venue.name,
    sport_type:     request.sub_venue.sport_type,
    day_of_week:    request.day_of_week,
    start_time:     request.start_time,
    end_time:       request.end_time,
    start_date:     toDateString(request.start_date),
    end_date:       toDateString(request.end_date),
    notes:          request.notes,
    source:         request.source,
    status:         request.status,
    review_note:    request.review_note,
    reviewed_at:    request.reviewed_at?.toISOString() ?? null,
    booking_count:  request._count.bookings,
    customer: {
      id:        request.customer.id,
      full_name: request.customer.full_name,
      email:     request.customer.email,
      phone:     request.customer.phone,
    },
    created_at: request.created_at.toISOString(),
    updated_at: request.updated_at.toISOString(),
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadRequest(requestId: string, actor: Actor): Promise<RequestWithRelations> {
  const request = await prisma.recurringBookingRequest.findUnique({
    where:   { id: requestId },
    include: requestInclude,
  })
  if (!request) {
    throw new NotFoundError('Permanent slot request')
  }

  if (actor.type === 'player') {
    if (request.customer_id !== actor.sub) {
      throw new NotFoundError('Permanent slot request')
    }
  } else if (actor.type === 'venue_staff') {
    if (request.company_id !== actor.company_id) {
      throw new NotFoundError('Permanent slot request')
    }
    assertVenueAccess(actor, request.location_id)
  }

  return request
}

/** Every date in the request range (from today onwards) that falls on the requested weekday. */
function occurrenceDates(request: { day_of_week: number; start_date: Date; end_date: Date }): string[] {
  const today = getTodayLocalDateString()
  const startDate = toDateString(request.start_date)
  const endDate = toDateString(request.end_date)

  let date = startDate > today ? startDate : today
  while (date <= endDate && getDayOfWeek(date) !== request.day_of_week) {
    date = addDays(date, 1)
  }

  const dates: string[] = []
  for (; date <= endDate; date = addDays(date, 7)) {
    dates.push(date)
  }
  return dates
}

function occurrenceWindow(request: { start_time: string; end_time: string }, date: string) {
  return {
    start: localDateTimeToUtc(date, recurringTimeToMinutes(request.start_time)),
    end:   localDateTimeToUtc(date, recurringTimeToMinutes(request.end_time, true)),
  }
}

interface SlotRow {
  id: string
  start_time: Date
  end_time: Date
  status: string
  locked_until: Date | null
  price: Prisma.Decimal
}

/**
 * Decides whether the slots overlapping a requested window can be booked as one block:
 * they must tile the window exactly (no gaps, no overhang) and all be free right now.
 */
function evaluateWindow(
  date: string,
  window: { start: Date; end: Date },
  overlapping: SlotRow[],
  daySlotCount: number,
): Occurrence {
  if (daySlotCount === 0) {
    return { date, status: 'not_generated', reason: 'Slots not generated yet', slot_ids: [], amount: 0 }
  }

  const slots = [...overlapping].sort((a, b) => a.start_time.getTime() - b.start_time.getTime())
  let cursor = window.start.getTime()
  for (const slot of slots) {
    if (slot.start_time.getTime() !== cursor) break
    cursor = slot.end_time.getTime()
  }
  const tiles = slots.length > 0 && cursor === window.end.getTime()
  if (!tiles) {
    return {
      date,
      status:   'no_matching_slots',
      reason:   "The requested time doesn't line up with this court's slots",
      slot_ids: [],
      amount:   0,
    }
  }

  const now = new Date()
  const busy = slots.find((slot) => slot.status !== 'available' || (slot.locked_until && slot.locked_until > now))
  if (busy) {
    return {
      date,
      status:   'conflict',
      reason:   busy.status === 'available' ? 'Someone is booking this slot right now' : `Slot already ${busy.status}`,
      slot_ids: slots.map((s) => s.id),
      amount:   0,
    }
  }

  return {
    date,
    status:   'available',
    slot_ids: slots.map((s) => s.id),
    amount:   slots.reduce((sum, s) => sum + Number(s.price), 0),
  }
}

async function previewOccurrences(request: RequestWithRelations): Promise<Occurrence[]> {
  const dates = occurrenceDates(request)
  if (dates.length === 0) return []

  const rangeStart = localDateTimeToUtc(dates[0]!, 0)
  const rangeEnd = localDateTimeToUtc(addDays(dates[dates.length - 1]!, 1), 0)
  const slots = await prisma.timeSlot.findMany({
    where:  { sub_venue_id: request.sub_venue_id, start_time: { gte: rangeStart, lt: rangeEnd } },
    select: { id: true, start_time: true, end_time: true, status: true, locked_until: true, price: true },
  })

  return dates.map((date) => {
    const window = occurrenceWindow(request, date)
    const dayStart = localDateTimeToUtc(date, 0).getTime()
    const dayEnd = localDateTimeToUtc(date, 24 * 60).getTime()
    const daySlots = slots.filter((s) => s.start_time.getTime() >= dayStart && s.start_time.getTime() < dayEnd)
    const overlapping = daySlots.filter((s) => s.start_time < window.end && s.end_time > window.start)
    return evaluateWindow(date, window, overlapping, daySlots.length)
  })
}

async function notifyStaff(request: { id: string; company_id: string; location_id: string }, customerName: string) {
  const members = await prisma.companyMember.findMany({
    where: {
      company_id: request.company_id,
      status:     'active',
      role: { permissions: { some: { permission: { key: 'bookings.read' } } } },
      OR: [
        { location_assignments: { some: { location_id: request.location_id } } },
        { location_assignments: { none: {} } },
      ],
    },
    select: { user_id: true },
  })

  if (members.length > 0) {
    await prisma.notification.createMany({
      data: members.map((member) => ({
        company_id: request.company_id,
        user_id:    member.user_id,
        type:       'recurring_request_submitted',
        title:      'New permanent slot request',
        body:       `${customerName} requested a weekly slot`,
        data:       { recurring_request_id: request.id } as Prisma.InputJsonValue,
      })),
    })
  }
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createRecurringRequest(actor: Actor, data: CreateRecurringRequestBody) {
  if (actor.type === 'platform_admin') {
    throw new ForbiddenError('Platform admins cannot request permanent slots')
  }

  const subVenue = await prisma.subVenue.findUnique({
    where:   { id: data.sub_venue_id },
    include: { location: true },
  })
  if (!subVenue || subVenue.status !== 'active' || subVenue.location.status !== 'active') {
    throw new NotFoundError('Sub-venue')
  }

  if (data.start_date < getTodayLocalDateString()) {
    throw new ValidationError('Start date cannot be in the past')
  }
  const hasOccurrence = occurrenceDates({
    day_of_week: data.day_of_week,
    start_date:  new Date(`${data.start_date}T00:00:00Z`),
    end_date:    new Date(`${data.end_date}T00:00:00Z`),
  }).length > 0
  if (!hasOccurrence) {
    throw new ValidationError('The date range does not include the selected weekday')
  }

  let customerId: string
  if (actor.type === 'player') {
    const customer = await prisma.customer.findUnique({ where: { id: actor.sub } })
    if (!customer) {
      throw new NotFoundError('Customer')
    }
    customerId = customer.id
  } else {
    if (subVenue.company_id !== actor.company_id) {
      throw new NotFoundError('Sub-venue')
    }
    assertVenueAccess(actor, subVenue.location_id)
    if (!data.customer_info) {
      throw new ValidationError('customer_info is required when staff create a permanent slot')
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
    customerId = customer.id
  }

  const duplicate = await prisma.recurringBookingRequest.findFirst({
    where: {
      customer_id:  customerId,
      sub_venue_id: subVenue.id,
      day_of_week:  data.day_of_week,
      start_time:   data.start_time,
      status:       'pending',
    },
    select: { id: true },
  })
  if (duplicate) {
    throw new ConflictError('You already have a pending request for this slot')
  }

  const request = await prisma.recurringBookingRequest.create({
    data: {
      company_id:   subVenue.company_id,
      location_id:  subVenue.location_id,
      sub_venue_id: subVenue.id,
      customer_id:  customerId,
      day_of_week:  data.day_of_week,
      start_time:   data.start_time,
      end_time:     data.end_time,
      start_date:   new Date(`${data.start_date}T00:00:00Z`),
      end_date:     new Date(`${data.end_date}T00:00:00Z`),
      notes:        data.notes || null,
      source:       actor.type === 'player' ? 'player' : 'staff',
    },
    include: requestInclude,
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  actor.type,
    company_id:  request.company_id,
    action:      'recurring_request.created',
    entity_type: 'recurring_booking_request',
    entity_id:   request.id,
    after:       { status: request.status, source: request.source },
  })

  if (actor.type === 'player') {
    await notifyStaff(request, request.customer.full_name)
  }

  return serializeRequest(request)
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function listRecurringRequests(actor: VenueStaffActor | PlayerActor, query: ListRecurringRequestsQuery) {
  const where: Prisma.RecurringBookingRequestWhereInput = {}

  if (actor.type === 'player') {
    where.customer_id = actor.sub
  } else {
    where.company_id = actor.company_id
    if (query.location_id) {
      assertVenueAccess(actor, query.location_id)
      where.location_id = query.location_id
    } else if (actor.location_ids.length > 0) {
      where.location_id = { in: actor.location_ids }
    }
  }
  if (query.status) {
    where.status = query.status
  }

  const [requests, total] = await Promise.all([
    prisma.recurringBookingRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { created_at: 'desc' },
      skip:    (query.page - 1) * query.limit,
      take:    query.limit,
    }),
    prisma.recurringBookingRequest.count({ where }),
  ])

  return {
    data: requests.map(serializeRequest),
    meta: { page: query.page, limit: query.limit, total },
  }
}

export async function getRecurringRequest(requestId: string, actor: Actor) {
  const request = await loadRequest(requestId, actor)

  const [occurrences, bookings] = await Promise.all([
    request.status === 'pending' ? previewOccurrences(request) : Promise.resolve(null),
    prisma.booking.findMany({
      where:   { recurring_request_id: request.id },
      include: { time_slot: { include: { sub_venue: { include: { location: true } } } } },
      orderBy: { time_slot: { start_time: 'asc' } },
    }),
  ])

  return {
    ...serializeRequest(request),
    occurrences,
    bookings: bookings.map((booking) => ({
      ...serializeBooking(booking),
      time_slot: serializeTimeSlotSummary(booking.time_slot),
    })),
  }
}

// ─── Review ─────────────────────────────────────────────────────────────────

export async function approveRecurringRequest(
  requestId: string,
  actor: VenueStaffActor,
  data: ApproveRecurringRequestBody,
) {
  const request = await loadRequest(requestId, actor)
  if (request.status !== 'pending') {
    throw new ConflictError(`Request is already ${request.status}`)
  }

  // Make sure slots exist for every date before checking availability. Generation is
  // idempotent — it only adds start times that are missing.
  const dates = occurrenceDates(request)
  for (const date of dates) {
    try {
      await generateSlotsForDate(request.sub_venue_id, date, false)
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err
    }
  }

  const baseRef = 'BK' + Date.now().toString(36).toUpperCase()

  const result = await prisma.$transaction(
    async (tx) => {
      const skipped: { date: string; reason: string }[] = []
      const created: string[] = []

      for (const date of dates) {
        const window = occurrenceWindow(request, date)
        const dayStart = localDateTimeToUtc(date, 0)
        const dayEnd = localDateTimeToUtc(date, 24 * 60)

        const dayIds = (
          await tx.timeSlot.findMany({
            where:  { sub_venue_id: request.sub_venue_id, start_time: { gte: dayStart, lt: dayEnd } },
            select: { id: true },
          })
        ).map((slot) => slot.id)
        const daySlots =
          dayIds.length === 0
            ? []
            : await tx.$queryRaw<SlotRow[]>`
                SELECT id, start_time, end_time, status, locked_until, price
                FROM time_slots WHERE id = ANY(${dayIds}::uuid[]) FOR UPDATE`
        const overlapping = daySlots.filter((s) => s.start_time < window.end && s.end_time > window.start)
        const occurrence = evaluateWindow(date, window, overlapping, daySlots.length)

        if (occurrence.status !== 'available') {
          skipped.push({ date, reason: occurrence.reason ?? occurrence.status })
          continue
        }

        for (const slot of overlapping) {
          const booking = await tx.booking.create({
            data: {
              company_id:           request.company_id,
              customer_id:          request.customer_id,
              time_slot_id:         slot.id,
              booking_ref:          `${baseRef}${created.length.toString(36).toUpperCase().padStart(2, '0')}`,
              total_amount:         slot.price,
              currency:             'LKR',
              status:               'confirmed',
              payment_method:       'pay_at_venue',
              notes:                request.notes,
              booked_by_type:       'venue_staff',
              booked_by_id:         actor.sub,
              recurring_request_id: request.id,
            },
          })
          await tx.paymentTransaction.create({
            data: {
              booking_id:   booking.id,
              company_id:   request.company_id,
              gateway_slug: 'payhere',
              amount:       slot.price,
              currency:     'LKR',
              status:       'pending',
            },
          })
          await tx.timeSlot.update({
            where: { id: slot.id },
            data:  { status: 'booked', lock_token: null, locked_until: null },
          })
          await logStatusChange(tx, booking.id, null, 'confirmed', actor.sub, 'Permanent slot approved')
          created.push(booking.id)
        }
      }

      if (created.length === 0) {
        throw new ConflictError('None of the requested dates are available — reject the request or ask for another time')
      }

      await tx.recurringBookingRequest.update({
        where: { id: request.id },
        data:  {
          status:      'approved',
          review_note: data.review_note || null,
          reviewed_by: actor.sub,
          reviewed_at: new Date(),
        },
      })

      await createAuditLog(
        {
          actor_id:    actor.sub,
          actor_type:  'venue_staff',
          company_id:  request.company_id,
          action:      'recurring_request.approved',
          entity_type: 'recurring_booking_request',
          entity_id:   request.id,
          before:      { status: 'pending' },
          after:       { status: 'approved', bookings_created: created.length, dates_skipped: skipped.length },
        },
        tx,
      )

      return { created, skipped }
    },
    { timeout: 30_000 },
  )

  return {
    request:          await getRecurringRequest(request.id, actor),
    bookings_created: result.created.length,
    skipped_dates:    result.skipped,
  }
}

export async function rejectRecurringRequest(
  requestId: string,
  actor: VenueStaffActor,
  data: RejectRecurringRequestBody,
) {
  const request = await loadRequest(requestId, actor)
  if (request.status !== 'pending') {
    throw new ConflictError(`Request is already ${request.status}`)
  }

  const updated = await prisma.recurringBookingRequest.update({
    where:   { id: request.id },
    data:    { status: 'rejected', review_note: data.review_note, reviewed_by: actor.sub, reviewed_at: new Date() },
    include: requestInclude,
  })

  await createAuditLog({
    actor_id:    actor.sub,
    actor_type:  'venue_staff',
    company_id:  request.company_id,
    action:      'recurring_request.rejected',
    entity_type: 'recurring_booking_request',
    entity_id:   request.id,
    before:      { status: 'pending' },
    after:       { status: 'rejected' },
  })

  return serializeRequest(updated)
}

/**
 * Withdraws a pending request, or ends an approved series: every future booking that is still
 * active is cancelled and its slot released. Past and checked-in bookings are left untouched.
 */
export async function cancelRecurringRequest(requestId: string, actor: Actor, data: CancelRecurringRequestBody) {
  if (actor.type === 'platform_admin') {
    throw new ForbiddenError('Platform admins cannot cancel permanent slots')
  }

  const request = await loadRequest(requestId, actor)

  if (request.status === 'approved') {
    if (actor.type === 'player') {
      throw new ForbiddenError('Please contact the venue to end an approved permanent slot')
    }
    if (!actor.permissions.includes('bookings.cancel')) {
      throw new ForbiddenError('Missing permission: bookings.cancel')
    }
  } else if (request.status !== 'pending') {
    throw new ConflictError(`Request is already ${request.status}`)
  }

  const cancelledCount = await prisma.$transaction(
    async (tx) => {
      const futureBookings = await tx.booking.findMany({
        where: {
          recurring_request_id: request.id,
          status:               { in: ACTIVE_BOOKING_STATUSES },
          time_slot:            { start_time: { gt: new Date() } },
        },
      })

      for (const booking of futureBookings) {
        await tx.booking.update({ where: { id: booking.id }, data: { status: 'cancelled' } })
        await tx.paymentTransaction.updateMany({
          where: { booking_id: booking.id },
          data:  { status: 'cancelled' },
        })
        await tx.timeSlot.update({
          where: { id: booking.time_slot_id },
          data:  { status: 'available', lock_token: null, locked_until: null },
        })
        await logStatusChange(
          tx,
          booking.id,
          booking.status,
          'cancelled',
          actor.sub,
          data.reason || 'Permanent slot cancelled',
        )
      }

      await tx.recurringBookingRequest.update({
        where: { id: request.id },
        data:  { status: 'cancelled', review_note: data.reason || request.review_note },
      })

      await createAuditLog(
        {
          actor_id:    actor.sub,
          actor_type:  actor.type,
          company_id:  request.company_id,
          action:      'recurring_request.cancelled',
          entity_type: 'recurring_booking_request',
          entity_id:   request.id,
          before:      { status: request.status },
          after:       { status: 'cancelled', bookings_cancelled: futureBookings.length },
        },
        tx,
      )

      return futureBookings.length
    },
    { timeout: 30_000 },
  )

  return { request: await getRecurringRequest(request.id, actor), bookings_cancelled: cancelledCount }
}
