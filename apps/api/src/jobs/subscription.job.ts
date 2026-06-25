import { Queue } from 'bullmq'
import { redis } from '../lib/redis.js'

const subscriptionQueue = new Queue('subscription-lifecycle', { connection: redis })

export async function addSubscriptionLifecycleJob(): Promise<void> {
  await subscriptionQueue.add(
    'run',
    {},
    { repeat: { pattern: '0 19 * * *' }, jobId: 'subscription-lifecycle-repeat' },
  )
}
