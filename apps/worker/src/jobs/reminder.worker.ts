import { Worker } from 'bullmq'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { formatLocalDate, formatLocalTime, getTomorrowLocalUtcRange } from '../lib/datetime.js'
import { sendEmail } from '../services/email.service.js'

export const reminderWorker = new Worker(
  'booking-reminder',
  async () => {
    const { start, end } = getTomorrowLocalUtcRange()

    const bookings = await prisma.booking.findMany({
      where: {
        status: 'confirmed',
        time_slot: { start_time: { gte: start, lt: end } },
      },
      include: {
        customer: true,
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

    let sent = 0

    for (const booking of bookings) {
      if (!booking.customer.email) {
        continue
      }

      const alreadySent = await prisma.emailLog.findFirst({
        where: { booking_id: booking.id, template_key: 'booking_reminder', status: 'sent' },
      })
      if (alreadySent) {
        continue
      }

      const { sub_venue: subVenue } = booking.time_slot
      const { location } = subVenue
      const { company } = location

      const data: Record<string, unknown> = {
        customerName: booking.customer.full_name,
        bookingRef:   booking.booking_ref,
        venueName:    location.name,
        subVenueName: subVenue.name,
        date:         formatLocalDate(booking.time_slot.start_time),
        time:         formatLocalTime(booking.time_slot.start_time),
        venueAddress: location.address ?? '',
      }

      if (company.branding?.primary_color) {
        data.primaryColor = company.branding.primary_color
      }
      if (company.branding?.logo_url) {
        data.logoUrl = company.branding.logo_url
      }

      await sendEmail({
        to:        booking.customer.email,
        template:  'booking_reminder',
        data,
        companyId: company.id,
        bookingId: booking.id,
      })

      sent++
    }

    console.log(`[booking-reminder] checked ${bookings.length} booking(s), sent ${sent} reminder(s)`)
  },
  { connection: redis },
)

reminderWorker.on('error', (err: Error) => {
  console.error('[booking-reminder worker] error:', err.message)
})
