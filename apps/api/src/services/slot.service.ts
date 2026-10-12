import crypto from 'node:crypto'
import {
  Prisma,
  type TimeSlot,
  type PricingRule,
  type SubVenue,
  type Location,
  type Company,
  type CompanyBranding,
} from '@sports-booking/db'
import type { VenueStaffActor, UpdateSlotBody } from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { createAuditLog } from '../middleware/audit.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import {
  timeStringToMinutes,
  localDateTimeToUtc,
  formatLocalDate,
  getTodayLocalDateString,
  getDayOfWeek,
  addDays,
  daysBetween,
} from '../lib/datetime.js'
import { getPaymentOptions, type PaymentOptions } from './payment-options.service.js'

const LOCK_TTL_SECONDS        = 600
const MAX_GENERATE_RANGE_DAYS = 90
const MAX_CALENDAR_RANGE_DAYS = 60

function serializeSlot(slot: TimeSlot, statusOverride?: string) {
  return {
    slotId:       slot.id,
    sub_venue_id: slot.sub_venue_id,
    start_time:   slot.start_time.toISOString(),
    end_time:     slot.end_time.toISOString(),
    price:        Number(slot.price),
    rate_type:    slot.rate_type,
    status:       statusOverride ?? slot.status,
  }
}

function serializeSlotDetail(
  paymentOptions: PaymentOptions,
  slot: TimeSlot & {
    sub_venue: SubVenue & {
      location: Location & {
        company: Company & { branding: CompanyBranding | null }
      }
    }
  },
  statusOverride?: string,
) {
  const { sub_venue } = slot
  const { location } = sub_venue
  const { company } = location

  return {
    ...serializeSlot(slot, statusOverride),
    payment_options: paymentOptions,
    sub_venue: {
      name:       sub_venue.name,
      sport_type: sub_venue.sport_type,
      location: {
        name: location.name,
        city: location.city,
        company: {
          name: company.name,
          slug: company.slug,
          branding: company.branding
            ? {
                primary_color:   company.branding.primary_color,
                secondary_color: company.branding.secondary_color,
                logo_url:        company.branding.logo_url,
              }
            : null,
        },
      },
    },
  }
}

async function getOwnedLocation(locationId: string, companyId: string) {
  const location = await prisma.location.findFirst({
    where: { id: locationId, company_id: companyId },
  })
  if (!location) {
    throw new NotFoundError('Location')
  }
  return location
}

export async function verifySubVenueOwnership(subVenueId: string, locationId: string, companyId: string) {
  const subVenue = await prisma.subVenue.findFirst({
    where:  { id: subVenueId, location_id: locationId, company_id: companyId },
    select: { id: true },
  })
  if (!subVenue) {
    throw new NotFoundError('Sub-venue')
  }
}

async function loadSubVenueWithSchedule(subVenueId: string) {
  const subVenue = await prisma.subVenue.findUnique({
    where:   { id: subVenueId },
    include: { location: { include: { operating_hours: true, holidays: true } } },
  })
  if (!subVenue) {
    throw new NotFoundError('Sub-venue')
  }
  return subVenue
}

// ─── Slot generation ────────────────────────────────────────────────────────

const RATE_TYPE_PRIORITY: Record<string, number> = { peak: 0, weekend: 1, off_peak: 2, flat: 3 }

function rateTypePriority(rule: PricingRule): number {
  return RATE_TYPE_PRIORITY[rule.rate_type] ?? 4
}

/** Minute-of-day for an end/close time, treating 00:00 as midnight at the end of the day. */
function toEndMinutes(time: string): number {
  const minutes = timeStringToMinutes(time)
  return minutes === 0 ? 24 * 60 : minutes
}

export async function generateSlotsForDate(
  subVenueId: string,
  date: string,
  overwrite = false,
  onSkip?: (reason: string) => void,
) {
  const subVenue = await loadSubVenueWithSchedule(subVenueId)
  const { location } = subVenue

  const dayOfWeek = getDayOfWeek(date)
  const operatingHour = location.operating_hours.find((h) => h.day_of_week === dayOfWeek)
  if (!operatingHour || operatingHour.is_closed) {
    onSkip?.(operatingHour ? 'Location is closed on this weekday' : 'No opening hours set for this weekday (Location → Hours tab)')
    return []
  }

  let openTime  = operatingHour.open_time
  let closeTime = operatingHour.close_time

  const holiday = location.holidays.find((h) => h.date.toISOString().slice(0, 10) === date)
  if (holiday) {
    if (holiday.full_day) {
      onSkip?.('Location holiday')
      return []
    }
    if (holiday.custom_open && holiday.custom_close) {
      openTime  = holiday.custom_open
      closeTime = holiday.custom_close
    }
  }

  const dateOnly = new Date(`${date}T00:00:00Z`)
  const rules = await prisma.pricingRule.findMany({
    orderBy: { created_at: 'asc' },
    where: {
      sub_venue_id: subVenueId,
      is_active:    true,
      AND: [
        { OR: [{ valid_from: null }, { valid_from: { lte: dateOnly } }] },
        { OR: [{ valid_until: null }, { valid_until: { gte: dateOnly } }] },
      ],
    },
  })

  const dayRules = rules.filter((rule) => {
    const days = rule.applicable_days as unknown as number[]
    return Array.isArray(days) && days.includes(dayOfWeek)
  })

  if (dayRules.length === 0) {
    throw new ValidationError('No pricing rules configured for this day')
  }

  const openMinutes  = timeStringToMinutes(openTime)
  // A close time of 00:00 means "until midnight".
  const closeMinutes = toEndMinutes(closeTime)

  const band = (r: PricingRule) =>
    r.peak_start && r.peak_end ? { start: timeStringToMinutes(r.peak_start), end: toEndMinutes(r.peak_end) } : null

  // A rule with a time band applies only when the slot starts inside that band; rules without a
  // band cover the rest of the day. Within each group the more specific rate type wins, and
  // ties go to the oldest rule so the result never depends on DB row order.
  const pickRule = (minute: number): PricingRule | undefined => {
    const banded = dayRules.filter((r) => {
      const b = band(r)
      return b !== null && minute >= b.start && minute < b.end
    })
    const candidates = banded.length > 0 ? banded : dayRules.filter((r) => band(r) === null)
    return candidates.sort((a, b) => rateTypePriority(a) - rateTypePriority(b))[0]
  }

  // Each slot takes its length from the rule that prices it, so a 60-min peak rule and a
  // 90-min off-peak rule can share a day. Uncovered gaps jump to the next band start.
  const intervals: { startMinutes: number; endMinutes: number; rule: PricingRule }[] = []
  let cursor = openMinutes
  while (cursor < closeMinutes) {
    const rule = pickRule(cursor)
    if (!rule) {
      const nextBandStart = dayRules
        .map((r) => band(r)?.start)
        .filter((start): start is number => start !== undefined && start > cursor)
        .sort((a, b) => a - b)[0]
      if (nextBandStart === undefined) break
      cursor = nextBandStart
      continue
    }
    const end = cursor + rule.duration_mins
    if (end > closeMinutes) break
    intervals.push({ startMinutes: cursor, endMinutes: end, rule })
    cursor = end
  }

  if (intervals.length === 0) {
    onSkip?.(
      closeMinutes - openMinutes < Math.min(...dayRules.map((r) => r.duration_mins))
        ? 'Opening hours are shorter than one slot'
        : 'No pricing rule covers the opening hours (add an Off-Peak or Flat rule without times)',
    )
    return []
  }

  const dayStartUtc = localDateTimeToUtc(date, 0)
  const dayEndUtc   = localDateTimeToUtc(date, 24 * 60)

  const existingSlots = await prisma.timeSlot.findMany({
    where: { sub_venue_id: subVenueId, start_time: { gte: dayStartUtc, lt: dayEndUtc } },
  })

  let remainingSlots = existingSlots
  if (overwrite) {
    const now = new Date()
    const removable = existingSlots.filter(
      (slot) => slot.status === 'available' && (!slot.locked_until || slot.locked_until < now),
    )
    if (removable.length > 0) {
      await prisma.timeSlot.deleteMany({ where: { id: { in: removable.map((s) => s.id) } } })
    }
    const removableIds = new Set(removable.map((s) => s.id))
    remainingSlots = existingSlots.filter((slot) => !removableIds.has(slot.id))
  }

  const existingStartTimes = new Set(remainingSlots.map((slot) => slot.start_time.getTime()))

  const rows = intervals
    .map((interval) => ({
      start_time: localDateTimeToUtc(date, interval.startMinutes),
      end_time:   localDateTimeToUtc(date, interval.endMinutes),
      rule:       interval.rule,
    }))
    .filter(({ start_time }) => !existingStartTimes.has(start_time.getTime()))
    .map(({ start_time, end_time, rule }) => ({
      id:              crypto.randomUUID(),
      sub_venue_id:    subVenueId,
      company_id:      subVenue.company_id,
      pricing_rule_id: rule.id,
      start_time,
      end_time,
      price:           rule.price_per_slot,
      status:          'available',
      rate_type:       rule.rate_type,
      lock_token:      null,
      locked_until:    null,
    }))

  if (rows.length === 0) {
    onSkip?.('Slots already exist for this day (tick Overwrite to regenerate)')
  } else {
    await prisma.timeSlot.createMany({ data: rows, skipDuplicates: true })
  }

  return rows.map((row) => ({
    slotId:     row.id,
    start_time: row.start_time.toISOString(),
    end_time:   row.end_time.toISOString(),
    price:      Number(row.price),
    rate_type:  row.rate_type,
    status:     row.status,
  }))
}

export async function generateSlotsForDateRange(
  subVenueId: string,
  fromDate: string,
  toDate: string,
  overwrite = false,
  actor?: VenueStaffActor,
) {
  if (daysBetween(fromDate, toDate) > MAX_GENERATE_RANGE_DAYS) {
    throw new ValidationError(`Date range cannot exceed ${MAX_GENERATE_RANGE_DAYS} days`)
  }

  const today = getTodayLocalDateString()
  const dates: { date: string; generated: number; reason?: string }[] = []
  let generated = 0
  let skipped   = 0

  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    if (date < today) {
      skipped++
      continue
    }

    try {
      let reason: string | undefined
      const slots = await generateSlotsForDate(subVenueId, date, overwrite, (r) => {
        reason = r
      })
      dates.push({ date, generated: slots.length, ...(slots.length === 0 && reason ? { reason } : {}) })
      generated += slots.length
    } catch (err) {
      if (err instanceof ValidationError) {
        dates.push({ date, generated: 0, reason: err.message })
      } else {
        throw err
      }
    }
  }

  if (actor) {
    await createAuditLog({
      actor_id:    actor.sub,
      actor_type:  'venue_staff',
      company_id:  actor.company_id,
      action:      'slot.generated',
      entity_type: 'sub_venue',
      entity_id:   subVenueId,
      after:       { from_date: fromDate, to_date: toDate, generated, skipped },
    })
  }

  return { generated, skipped, dates }
}

// ─── Browsing ───────────────────────────────────────────────────────────────

export async function getAvailableSlots(subVenueId: string, date: string) {
  const dayStartUtc = localDateTimeToUtc(date, 0)
  const dayEndUtc   = localDateTimeToUtc(date, 24 * 60)

  const slots = await prisma.timeSlot.findMany({
    where: {
      sub_venue_id: subVenueId,
      start_time:   { gte: dayStartUtc, lt: dayEndUtc },
      status:       { not: 'inactive' },
    },
    orderBy: { start_time: 'asc' },
  })

  const availableSlots = slots.filter((slot) => slot.status === 'available')
  let lockFlags: boolean[] = []
  if (availableSlots.length > 0) {
    const pipeline = redis.pipeline()
    for (const slot of availableSlots) {
      pipeline.exists(`slot:lock:${slot.id}`)
    }
    const results = await pipeline.exec()
    lockFlags = (results ?? []).map(([, result]) => result === 1)
  }

  const available: ReturnType<typeof serializeSlot>[] = []
  const locked:    ReturnType<typeof serializeSlot>[] = []
  const booked:    ReturnType<typeof serializeSlot>[] = []

  let availableIndex = 0
  for (const slot of slots) {
    if (slot.status === 'booked') {
      booked.push(serializeSlot(slot))
      continue
    }
    if (slot.status === 'available') {
      const isLocked = lockFlags[availableIndex++] ?? false
      if (isLocked) {
        locked.push(serializeSlot(slot, 'locked'))
      } else {
        available.push(serializeSlot(slot))
      }
    }
  }

  return { available, locked, booked }
}

export async function getSlotDetail(slotId: string) {
  const slot = await prisma.timeSlot.findUnique({
    where: { id: slotId },
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
  })
  if (!slot || slot.status === 'inactive') {
    throw new NotFoundError('Slot')
  }

  const paymentOptions = await getPaymentOptions(slot.company_id)

  if (slot.status === 'available') {
    const isLocked = (await redis.exists(`slot:lock:${slotId}`)) === 1
    return serializeSlotDetail(paymentOptions, slot, isLocked ? 'locked' : 'available')
  }

  return serializeSlotDetail(paymentOptions, slot)
}

export async function getSlotCalendar(
  locationId: string,
  companyId: string,
  actorLocationIds: string[],
  fromDate: string,
  toDate: string,
) {
  await getOwnedLocation(locationId, companyId)

  if (actorLocationIds.length > 0 && !actorLocationIds.includes(locationId)) {
    throw new ForbiddenError('You do not have access to this location')
  }

  if (daysBetween(fromDate, toDate) > MAX_CALENDAR_RANGE_DAYS) {
    throw new ValidationError(`Date range cannot exceed ${MAX_CALENDAR_RANGE_DAYS} days`)
  }

  const subVenues = await prisma.subVenue.findMany({
    where:  { location_id: locationId, status: 'active' },
    select: { id: true },
  })

  const rangeStartUtc = localDateTimeToUtc(fromDate, 0)
  const rangeEndUtc   = localDateTimeToUtc(toDate, 24 * 60)

  const slots = await prisma.timeSlot.findMany({
    where: {
      sub_venue_id: { in: subVenues.map((sv) => sv.id) },
      start_time:   { gte: rangeStartUtc, lt: rangeEndUtc },
      status:       { not: 'inactive' },
    },
    select: { sub_venue_id: true, start_time: true, status: true, locked_until: true },
  })

  const now = new Date()
  type Counts = { available: number; booked: number; locked: number }
  const counts = new Map<string, Counts>()

  for (const slot of slots) {
    const date = formatLocalDate(slot.start_time)
    const key  = `${date}|${slot.sub_venue_id}`
    const entry = counts.get(key) ?? { available: 0, booked: 0, locked: 0 }

    if (slot.status === 'booked') {
      entry.booked++
    } else if (slot.status === 'available') {
      if (slot.locked_until && slot.locked_until > now) {
        entry.locked++
      } else {
        entry.available++
      }
    }

    counts.set(key, entry)
  }

  const result: ({ date: string; sub_venue_id: string } & Counts)[] = []
  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    for (const subVenue of subVenues) {
      const key = `${date}|${subVenue.id}`
      const entry = counts.get(key) ?? { available: 0, booked: 0, locked: 0 }
      result.push({ date, sub_venue_id: subVenue.id, ...entry })
    }
  }

  return result
}

// ─── Locking ────────────────────────────────────────────────────────────────

export async function lockSlot(slotId: string) {
  const lockToken = crypto.randomUUID()
  const lockKey   = `slot:lock:${slotId}`

  const acquired = await redis.set(lockKey, lockToken, 'EX', LOCK_TTL_SECONDS, 'NX')
  if (!acquired) {
    throw new ConflictError('Slot is already being booked')
  }

  try {
    const lockedUntil = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ status: string; locked_until: Date | null }[]>`
        SELECT status, locked_until FROM time_slots WHERE id = ${slotId}::uuid FOR UPDATE
      `
      const row = rows[0]
      if (!row) {
        throw new NotFoundError('Slot')
      }

      const now = new Date()
      if (row.status !== 'available' || (row.locked_until && row.locked_until > now)) {
        throw new ConflictError('Slot is already being booked')
      }

      const newLockedUntil = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000)
      await tx.timeSlot.update({
        where: { id: slotId },
        data:  { lock_token: lockToken, locked_until: newLockedUntil },
      })

      return newLockedUntil
    })

    return { slotId, lockToken, expiresAt: lockedUntil.toISOString() }
  } catch (err) {
    await redis.del(lockKey)
    throw err
  }
}

export async function unlockSlot(slotId: string, lockToken: string) {
  const lockKey = `slot:lock:${slotId}`
  const stored  = await redis.get(lockKey)

  if (!stored || stored !== lockToken) {
    throw new ForbiddenError('This is not your lock')
  }

  await redis.del(lockKey)

  try {
    await prisma.timeSlot.update({
      where: { id: slotId },
      data:  { lock_token: null, locked_until: null },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new NotFoundError('Slot')
    }
    throw err
  }

  return { message: 'Slot released' }
}

export async function releaseExpiredLocks(): Promise<number> {
  const expired = await prisma.timeSlot.findMany({
    where:  { status: 'available', lock_token: { not: null }, locked_until: { lt: new Date() } },
    select: { id: true },
  })

  if (expired.length === 0) {
    return 0
  }

  const ids = expired.map((slot) => slot.id)

  await prisma.timeSlot.updateMany({
    where: { id: { in: ids } },
    data:  { lock_token: null, locked_until: null },
  })

  await Promise.all(ids.map((id) => redis.del(`slot:lock:${id}`)))

  return ids.length
}

// ─── Management ─────────────────────────────────────────────────────────────

async function getOwnedSlot(slotId: string, actor: VenueStaffActor) {
  const slot = await prisma.timeSlot.findUnique({
    where:   { id: slotId },
    include: { sub_venue: { select: { location_id: true, company_id: true } } },
  })

  if (!slot || slot.sub_venue.company_id !== actor.company_id) {
    throw new NotFoundError('Slot')
  }

  if (actor.location_ids.length > 0 && !actor.location_ids.includes(slot.sub_venue.location_id)) {
    throw new ForbiddenError('You do not have access to this location')
  }

  return slot
}

export async function updateSlot(slotId: string, actor: VenueStaffActor, data: UpdateSlotBody) {
  const slot = await getOwnedSlot(slotId, actor)

  if (data.status === 'inactive') {
    if (slot.status === 'booked') {
      throw new ConflictError('Cannot deactivate a slot with an active booking')
    }
    const activeBooking = await prisma.booking.findFirst({
      where: { time_slot_id: slotId, status: { not: 'cancelled' } },
    })
    if (activeBooking) {
      throw new ConflictError('Cannot deactivate a slot with an active booking')
    }
  }

  const updated = await prisma.timeSlot.update({
    where: { id: slotId },
    data:  { status: data.status, price: data.price },
  })

  return serializeSlot(updated)
}

export async function deleteSlot(slotId: string, actor: VenueStaffActor) {
  const slot = await getOwnedSlot(slotId, actor)

  if (slot.status !== 'available') {
    throw new ConflictError('Only available slots can be deleted')
  }

  if (slot.lock_token !== null || (slot.locked_until && slot.locked_until > new Date())) {
    throw new ConflictError('Cannot delete a locked slot')
  }

  await prisma.timeSlot.delete({ where: { id: slotId } })

  return { message: 'Slot deleted' }
}
