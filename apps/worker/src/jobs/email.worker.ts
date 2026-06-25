import { Worker } from 'bullmq'
import type { EmailJobData } from '@sports-booking/types'
import { redis } from '../lib/redis.js'
import { sendEmail } from '../services/email.service.js'

const EMAIL_RETRY_DELAYS_MS = [60_000, 300_000, 900_000]

export const emailWorker = new Worker<EmailJobData>(
  'email',
  async (job) => {
    await sendEmail(job.data)
  },
  {
    connection: redis,
    settings: {
      backoffStrategy: (attemptsMade) => EMAIL_RETRY_DELAYS_MS[attemptsMade - 1] ?? EMAIL_RETRY_DELAYS_MS.at(-1) ?? 900_000,
    },
  },
)

emailWorker.on('failed', (job, err: Error) => {
  console.error('[email worker] job', job?.id, 'failed:', err.message)
})

emailWorker.on('error', (err: Error) => {
  console.error('[email worker] error:', err.message)
})
