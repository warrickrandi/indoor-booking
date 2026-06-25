import { Readable } from 'node:stream'
import { Prisma } from '@sports-booking/db'
import type {
  VenueStaffActor,
  DailySummaryQuery,
  RevenueReportQuery,
  OccupancyReportQuery,
  ExportReportQuery,
} from '@sports-booking/types'
import { prisma } from '../lib/prisma.js'
import { localDateTimeToUtc, addDays, formatLocalDate, formatLocalTime, getDayOfWeek } from '../lib/datetime.js'
import { assertVenueAccess } from './booking.service.js'

const EXPORT_BATCH_SIZE = 500

function resolveSubVenueWhere(actor: VenueStaffActor, locationId?: string): Prisma.SubVenueWhereInput {
  if (locationId) {
    assertVenueAccess(actor, locationId)
    return { location: { company_id: actor.company_id, id: locationId } }
  }
  if (actor.location_ids.length > 0) {
    return { location: { company_id: actor.company_id, id: { in: actor.location_ids } } }
  }
  return { location: { company_id: actor.company_id } }
}

// ─── Daily summary ──────────────────────────────────────────────────────────

export async function getDailySummary(actor: VenueStaffActor, query: DailySummaryQuery) {
  const subVenueWhere = resolveSubVenueWhere(actor, query.location_id)
  const dayStart = localDateTimeToUtc(query.date, 0)
  const dayEnd   = localDateTimeToUtc(addDays(query.date, 1), 0)

  const [bookingsByStatus, paidTransactions, subVenues, pendingVerifications] = await Promise.all([
    prisma.booking.groupBy({
      by:    ['status'],
      where: {
        company_id: actor.company_id,
        time_slot:  { start_time: { gte: dayStart, lt: dayEnd }, sub_venue: subVenueWhere },
      },
      _count: true,
    }),
    prisma.paymentTransaction.findMany({
      where: {
        status:  'paid',
        booking: {
          company_id: actor.company_id,
          time_slot:  { start_time: { gte: dayStart, lt: dayEnd }, sub_venue: subVenueWhere },
        },
      },
      include: { booking: { select: { payment_method: true } } },
    }),
    prisma.subVenue.findMany({
      where:   subVenueWhere,
      include: { time_slots: { where: { start_time: { gte: dayStart, lt: dayEnd } } } },
    }),
    prisma.booking.count({
      where: {
        company_id: actor.company_id,
        status:     'pending_verification',
        time_slot:  { sub_venue: subVenueWhere },
      },
    }),
  ])

  const revenueByMethod = new Map<string, number>()
  for (const transaction of paidTransactions) {
    const method = transaction.booking.payment_method ?? 'unknown'
    revenueByMethod.set(method, (revenueByMethod.get(method) ?? 0) + Number(transaction.amount))
  }

  const occupancy = subVenues.map((subVenue) => {
    const total_slots  = subVenue.time_slots.length
    const booked_slots = subVenue.time_slots.filter((slot) => slot.status === 'booked' || slot.status === 'reserved').length
    return {
      sub_venue_id:   subVenue.id,
      sub_venue_name: subVenue.name,
      total_slots,
      booked_slots,
      occupancy_rate: total_slots > 0 ? booked_slots / total_slots : 0,
    }
  })

  return {
    date:                       query.date,
    bookings_by_status:         bookingsByStatus.map((row) => ({ status: row.status, count: row._count })),
    revenue_by_payment_method:  Array.from(revenueByMethod.entries()).map(([payment_method, total]) => ({ payment_method, total })),
    occupancy,
    pending_verifications:      pendingVerifications,
  }
}

// ─── Revenue ────────────────────────────────────────────────────────────────

function revenuePeriodKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
  const localDate = formatLocalDate(date)

  if (groupBy === 'month') {
    return localDate.slice(0, 7)
  }
  if (groupBy === 'week') {
    const dow = getDayOfWeek(localDate)
    return addDays(localDate, dow === 0 ? -6 : -(dow - 1))
  }
  return localDate
}

export async function getRevenue(actor: VenueStaffActor, query: RevenueReportQuery) {
  const subVenueWhere = resolveSubVenueWhere(actor, query.location_id)
  const fromUtc = localDateTimeToUtc(query.from_date, 0)
  const toUtc   = localDateTimeToUtc(addDays(query.to_date, 1), 0)

  const [transactions, locationCount] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        status:  'paid',
        paid_at: { gte: fromUtc, lt: toUtc },
        booking: { company_id: actor.company_id, time_slot: { sub_venue: subVenueWhere } },
      },
      include: {
        booking: {
          select: {
            payment_method: true,
            time_slot: {
              select: {
                sub_venue: {
                  select: { id: true, name: true, location_id: true, location: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.location.count({ where: { company_id: actor.company_id } }),
  ])

  type PeriodBucket = { period: string; total: number; online: number; bank_transfer: number; pay_at_venue: number }
  const byPeriod   = new Map<string, PeriodBucket>()
  const byLocation = new Map<string, { location_id: string; location_name: string; total: number }>()
  const bySubVenue = new Map<string, { sub_venue_id: string; sub_venue_name: string; total: number }>()

  for (const transaction of transactions) {
    const amount  = Number(transaction.amount)
    const period  = revenuePeriodKey(transaction.paid_at!, query.group_by ?? 'day')
    const method  = transaction.booking.payment_method

    const bucket = byPeriod.get(period) ?? { period, total: 0, online: 0, bank_transfer: 0, pay_at_venue: 0 }
    bucket.total += amount
    if (method === 'online' || method === 'bank_transfer' || method === 'pay_at_venue') {
      bucket[method] += amount
    }
    byPeriod.set(period, bucket)

    const subVenue = transaction.booking.time_slot.sub_venue
    const locationBucket = byLocation.get(subVenue.location_id) ?? {
      location_id:   subVenue.location_id,
      location_name: subVenue.location.name,
      total:         0,
    }
    locationBucket.total += amount
    byLocation.set(subVenue.location_id, locationBucket)

    const subVenueBucket = bySubVenue.get(subVenue.id) ?? {
      sub_venue_id:   subVenue.id,
      sub_venue_name: subVenue.name,
      total:          0,
    }
    subVenueBucket.total += amount
    bySubVenue.set(subVenue.id, subVenueBucket)
  }

  return {
    by_period:   Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period)),
    by_location: locationCount > 1 ? Array.from(byLocation.values()) : [],
    by_sub_venue: Array.from(bySubVenue.values()),
  }
}

// ─── Occupancy ──────────────────────────────────────────────────────────────

export async function getOccupancy(actor: VenueStaffActor, query: OccupancyReportQuery) {
  const subVenueWhere = resolveSubVenueWhere(actor, query.location_id)
  const fromUtc = localDateTimeToUtc(query.from_date, 0)
  const toUtc   = localDateTimeToUtc(addDays(query.to_date, 1), 0)

  const [subVenues, bookings] = await Promise.all([
    prisma.subVenue.findMany({
      where:   subVenueWhere,
      include: { time_slots: { where: { start_time: { gte: fromUtc, lt: toUtc } } } },
    }),
    prisma.booking.findMany({
      where: {
        company_id: actor.company_id,
        status:     { not: 'cancelled' },
        time_slot:  { start_time: { gte: fromUtc, lt: toUtc }, sub_venue: subVenueWhere },
      },
      select: { time_slot: { select: { start_time: true } } },
    }),
  ])

  const data: {
    date: string
    sub_venue_id: string
    sub_venue_name: string
    total_slots: number
    booked_slots: number
    occupancy_rate: number
  }[] = []

  for (const subVenue of subVenues) {
    const byDate = new Map<string, { total: number; booked: number }>()
    for (const slot of subVenue.time_slots) {
      const date = formatLocalDate(slot.start_time)
      const entry = byDate.get(date) ?? { total: 0, booked: 0 }
      entry.total += 1
      if (slot.status === 'booked' || slot.status === 'reserved') {
        entry.booked += 1
      }
      byDate.set(date, entry)
    }
    for (const [date, entry] of byDate) {
      data.push({
        date,
        sub_venue_id:   subVenue.id,
        sub_venue_name: subVenue.name,
        total_slots:    entry.total,
        booked_slots:   entry.booked,
        occupancy_rate: entry.total > 0 ? entry.booked / entry.total : 0,
      })
    }
  }

  const hourCounts = new Map<string, number>()
  for (const booking of bookings) {
    const hour = formatLocalTime(booking.time_slot.start_time).split(':')[0]!
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }
  const peak_hours = Array.from(hourCounts.entries())
    .map(([hour, booking_count]) => ({ hour, booking_count }))
    .sort((a, b) => b.booking_count - a.booking_count)

  return { data, peak_hours }
}

// ─── CSV export ─────────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  const str = String(value)
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',') + '\r\n'
}

async function* generateBookingsCsv(actor: VenueStaffActor, query: ExportReportQuery) {
  yield csvRow([
    'booking_ref', 'status', 'payment_method', 'total_amount', 'currency',
    'customer_name', 'customer_email', 'sub_venue', 'location', 'start_time', 'created_at',
  ])

  const subVenueWhere = resolveSubVenueWhere(actor, query.location_id)
  const fromUtc = localDateTimeToUtc(query.from_date, 0)
  const toUtc   = localDateTimeToUtc(addDays(query.to_date, 1), 0)

  let skip = 0
  for (;;) {
    const batch = await prisma.booking.findMany({
      where: {
        company_id: actor.company_id,
        time_slot:  { start_time: { gte: fromUtc, lt: toUtc }, sub_venue: subVenueWhere },
      },
      include: { customer: true, time_slot: { include: { sub_venue: { include: { location: true } } } } },
      orderBy: { created_at: 'asc' },
      skip,
      take: EXPORT_BATCH_SIZE,
    })

    if (batch.length === 0) {
      break
    }

    for (const booking of batch) {
      yield csvRow([
        booking.booking_ref,
        booking.status,
        booking.payment_method,
        Number(booking.total_amount),
        booking.currency,
        booking.customer.full_name,
        booking.customer.email,
        booking.time_slot.sub_venue.name,
        booking.time_slot.sub_venue.location.name,
        booking.time_slot.start_time.toISOString(),
        booking.created_at.toISOString(),
      ])
    }

    if (batch.length < EXPORT_BATCH_SIZE) {
      break
    }
    skip += EXPORT_BATCH_SIZE
  }
}

async function* generateTransactionsCsv(actor: VenueStaffActor, query: ExportReportQuery) {
  yield csvRow(['transaction_id', 'booking_ref', 'gateway_slug', 'amount', 'currency', 'status', 'paid_at', 'created_at'])

  const subVenueWhere = resolveSubVenueWhere(actor, query.location_id)
  const fromUtc = localDateTimeToUtc(query.from_date, 0)
  const toUtc   = localDateTimeToUtc(addDays(query.to_date, 1), 0)

  let skip = 0
  for (;;) {
    const batch = await prisma.paymentTransaction.findMany({
      where: {
        company_id: actor.company_id,
        created_at: { gte: fromUtc, lt: toUtc },
        booking:    { time_slot: { sub_venue: subVenueWhere } },
      },
      include: { booking: { select: { booking_ref: true } } },
      orderBy: { created_at: 'asc' },
      skip,
      take: EXPORT_BATCH_SIZE,
    })

    if (batch.length === 0) {
      break
    }

    for (const transaction of batch) {
      yield csvRow([
        transaction.id,
        transaction.booking.booking_ref,
        transaction.gateway_slug,
        Number(transaction.amount),
        transaction.currency,
        transaction.status,
        transaction.paid_at?.toISOString() ?? '',
        transaction.created_at.toISOString(),
      ])
    }

    if (batch.length < EXPORT_BATCH_SIZE) {
      break
    }
    skip += EXPORT_BATCH_SIZE
  }
}

export function streamExport(actor: VenueStaffActor, query: ExportReportQuery): { stream: Readable; filename: string } {
  if (query.type === 'transactions') {
    return { stream: Readable.from(generateTransactionsCsv(actor, query)), filename: 'transactions-report.csv' }
  }
  return { stream: Readable.from(generateBookingsCsv(actor, query)), filename: 'bookings-report.csv' }
}
