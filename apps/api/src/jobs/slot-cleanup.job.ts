import { Queue } from 'bullmq'
import { redis } from '../lib/redis.js'

const slotCleanupQueue = new Queue('slot-cleanup', { connection: redis })

export async function addSlotCleanupJob(): Promise<void> {
  await slotCleanupQueue.add(
    'release-expired-locks',
    {},
    { repeat: { every: 5 * 60 * 1000 }, jobId: 'slot-cleanup-repeat' },
  )
}
