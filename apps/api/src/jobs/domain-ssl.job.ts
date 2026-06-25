import { Queue } from 'bullmq'
import type { DomainSslJobData } from '@sports-booking/types'
import { redis } from '../lib/redis.js'

const domainSslQueue = new Queue<DomainSslJobData>('domain-ssl-check', { connection: redis })

export async function addDomainSslCheckJob(data: DomainSslJobData): Promise<void> {
  await domainSslQueue.add('check', data, {
    attempts: 30,
    backoff:  { type: 'fixed', delay: 2 * 60 * 1000 },
  })
}
