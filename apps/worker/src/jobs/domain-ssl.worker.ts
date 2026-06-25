import { Worker, Queue } from 'bullmq'
import type { DomainSslJobData, EmailJobData } from '@sports-booking/types'
import { PLATFORM_NAME, DEFAULT_PRIMARY_COLOR } from '@sports-booking/email'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { env } from '../lib/env.js'
import { checkDomainSSL } from '../lib/vercel-domains.js'

const emailQueue = new Queue<EmailJobData>('email', { connection: redis })

export const domainSslWorker = new Worker<DomainSslJobData>(
  'domain-ssl-check',
  async (job) => {
    const { domainId, domain, companyId } = job.data

    const ready = await checkDomainSSL(domain)
    if (!ready) {
      throw new Error(`SSL not yet provisioned for ${domain}`)
    }

    await prisma.companyDomain.update({
      where: { id: domainId },
      data:  { ssl_provisioned: true },
    })

    const company = await prisma.company.findUnique({
      where:  { id: companyId },
      include: { branding: true },
    })

    const owner = await prisma.companyMember.findFirst({
      where:   { company_id: companyId, role: { name: 'owner' } },
      include: { user: { select: { email: true } } },
    })

    if (owner?.user.email) {
      await emailQueue.add('send', {
        to:       owner.user.email,
        template: 'domain_live',
        data: {
          domain,
          dashboardUrl: `${env.FRONTEND_URL}/settings/domains`,
          primaryColor: company?.branding?.primary_color ?? DEFAULT_PRIMARY_COLOR,
          logoUrl:      company?.branding?.logo_url ?? undefined,
          platformName: PLATFORM_NAME,
        },
        companyId,
      })
    }

    console.log(`[domain-ssl-check] ${domain} is live`)
  },
  { connection: redis },
)

domainSslWorker.on('failed', (job, err: Error) => {
  const attempts = job?.opts.attempts ?? 0
  if (job && job.attemptsMade >= attempts) {
    console.warn(`[domain-ssl-check] gave up on ${job.data.domain} after ${attempts} attempts:`, err.message)
  }
})

domainSslWorker.on('error', (err: Error) => {
  console.error('[domain-ssl-check worker] error:', err.message)
})
