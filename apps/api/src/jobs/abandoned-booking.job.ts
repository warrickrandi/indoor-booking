import { Queue } from 'bullmq'
import { redis } from '../lib/redis.js'

const abandonedBookingQueue = new Queue('abandoned-booking-cleanup', { connection: redis })

export async function addAbandonedBookingJob(): Promise<void> {
  await abandonedBookingQueue.add(
    'cancel-abandoned',
    {},
    { repeat: { every: 15 * 60 * 1000 }, jobId: 'abandoned-booking-cleanup-repeat' },
  )
}
