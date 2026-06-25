import { Worker } from 'bullmq'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'

export const slotCleanupWorker = new Worker(
  'slot-cleanup',
  async () => {
    const expired = await prisma.timeSlot.findMany({
      where:  { status: 'available', lock_token: { not: null }, locked_until: { lt: new Date() } },
      select: { id: true },
    })

    if (expired.length === 0) {
      return
    }

    const ids = expired.map((slot) => slot.id)

    await prisma.timeSlot.updateMany({
      where: { id: { in: ids } },
      data:  { lock_token: null, locked_until: null },
    })

    await Promise.all(ids.map((id) => redis.del(`slot:lock:${id}`)))

    console.log('[slot-cleanup] Released', ids.length, 'expired slot locks')
  },
  { connection: redis },
)

slotCleanupWorker.on('error', (err: Error) => {
  console.error('[slot-cleanup worker] error:', err.message)
})
