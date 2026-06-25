/**
 * Data-integrity sweep for the booking/slot/payment state machine.
 *
 * Run via: npx tsx apps/api/scripts/verify-state-machine.ts
 */
// Load + validate env vars (populates process.env.DATABASE_URL for the Prisma client below).
import '../src/lib/env.js'
import { prisma } from '../src/lib/prisma.js'

const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000)

async function main() {
  let anomalyCount = 0

  // 1. Confirmed bookings whose slot was not marked 'booked'.
  const confirmedBookings = await prisma.booking.findMany({
    where:   { status: 'confirmed' },
    include: { time_slot: { select: { id: true, status: true } } },
  })
  for (const booking of confirmedBookings) {
    if (booking.time_slot.status !== 'booked') {
      anomalyCount++
      console.warn(
        `[ANOMALY] booking ${booking.id} (${booking.booking_ref}) status='confirmed' ` +
          `but slot ${booking.time_slot.id} status='${booking.time_slot.status}' (expected 'booked')`,
      )
    }
  }

  // 2. Cancelled bookings whose slot was not restored to 'available'.
  const cancelledBookings = await prisma.booking.findMany({
    where:   { status: 'cancelled' },
    include: { time_slot: { select: { id: true, status: true } } },
  })
  for (const booking of cancelledBookings) {
    if (booking.time_slot.status !== 'available') {
      anomalyCount++
      console.warn(
        `[ANOMALY] booking ${booking.id} (${booking.booking_ref}) status='cancelled' ` +
          `but slot ${booking.time_slot.id} status='${booking.time_slot.status}' (expected 'available')`,
      )
    }
  }

  // 3. Bookings stuck in 'pending_payment' for over an hour (abandoned PayHere checkouts).
  const abandonedBookings = await prisma.booking.findMany({
    where:  { status: 'pending_payment', created_at: { lt: ONE_HOUR_AGO } },
    select: { id: true, booking_ref: true, created_at: true },
  })
  for (const booking of abandonedBookings) {
    anomalyCount++
    console.warn(
      `[ANOMALY] booking ${booking.id} (${booking.booking_ref}) status='pending_payment' ` +
        `since ${booking.created_at.toISOString()} (older than 1 hour, likely abandoned)`,
    )
  }

  // 4. Paid transactions whose booking was never confirmed.
  const paidTransactions = await prisma.paymentTransaction.findMany({
    where:   { status: 'paid' },
    include: { booking: { select: { id: true, booking_ref: true, status: true } } },
  })
  for (const tx of paidTransactions) {
    if (tx.booking.status !== 'confirmed') {
      anomalyCount++
      console.warn(
        `[ANOMALY] payment_transaction ${tx.id} status='paid' but booking ${tx.booking.id} ` +
          `(${tx.booking.booking_ref}) status='${tx.booking.status}' (expected 'confirmed')`,
      )
    }
  }

  console.log('---')
  if (anomalyCount === 0) {
    console.log('verify-state-machine: no anomalies found.')
  } else {
    console.log(`verify-state-machine: found ${anomalyCount} anomaly(ies) — see warnings above.`)
  }
}

main()
  .catch((err) => {
    console.error('verify-state-machine: failed to run', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
