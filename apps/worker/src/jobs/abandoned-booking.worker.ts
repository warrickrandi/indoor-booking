import { Worker } from 'bullmq'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'

const ABANDONED_AFTER_MS = 30 * 60 * 1000

export const abandonedBookingWorker = new Worker(
  'abandoned-booking-cleanup',
  async () => {
    const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS)

    const abandoned = await prisma.booking.findMany({
      where:  { status: 'pending_payment', created_at: { lt: cutoff } },
      select: { id: true, time_slot_id: true },
    })

    if (abandoned.length === 0) {
      return
    }

    for (const booking of abandoned) {
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data:  { status: 'cancelled' },
        })

        await tx.timeSlot.update({
          where: { id: booking.time_slot_id },
          data:  { status: 'available', lock_token: null, locked_until: null },
        })

        await tx.bookingStatusLog.create({
          data: {
            booking_id:  booking.id,
            from_status: 'pending_payment',
            to_status:   'cancelled',
            changed_by:  null,
            reason:      'Abandoned online payment - auto-cancelled after 30 minutes',
          },
        })
      })

      await redis.del(`slot:lock:${booking.time_slot_id}`)
    }

    console.log(`[abandoned-booking-cleanup] cancelled ${abandoned.length} abandoned booking(s)`)
  },
  { connection: redis },
)

abandonedBookingWorker.on('error', (err: Error) => {
  console.error('[abandoned-booking-cleanup worker] error:', err.message)
})
