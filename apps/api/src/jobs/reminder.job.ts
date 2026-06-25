import { Queue } from 'bullmq'
import { redis } from '../lib/redis.js'

const reminderQueue = new Queue('booking-reminder', { connection: redis })

export async function addReminderJob(): Promise<void> {
  await reminderQueue.add(
    'run',
    {},
    { repeat: { pattern: '30 4 * * *' }, jobId: 'booking-reminder-repeat' },
  )
}
