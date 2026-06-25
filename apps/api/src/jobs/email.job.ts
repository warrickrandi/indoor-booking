import { Queue } from 'bullmq'
import type { EmailJobData } from '@sports-booking/types'
import type { TemplateKey } from '@sports-booking/email'
import { redis } from '../lib/redis.js'

const emailQueue = new Queue<EmailJobData>('email', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: 'custom' },
  },
})

export interface AddEmailJobOptions {
  companyId?: string | null
  bookingId?: string
}

export async function addEmailJob(
  to: string,
  template: TemplateKey,
  data: Record<string, unknown> = {},
  options: AddEmailJobOptions = {},
): Promise<void> {
  await emailQueue.add('send', {
    to,
    template,
    data,
    companyId: options.companyId,
    bookingId: options.bookingId,
  })
}
