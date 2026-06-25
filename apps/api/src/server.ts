import { buildApp } from './app.js'
import { env } from './lib/env.js'
import { addSlotCleanupJob } from './jobs/slot-cleanup.job.js'
import { addReminderJob } from './jobs/reminder.job.js'
import { addAbandonedBookingJob } from './jobs/abandoned-booking.job.js'
import { addSubscriptionLifecycleJob } from './jobs/subscription.job.js'

async function main() {
  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: env.HOST })
    app.log.info(`API server listening on http://${env.HOST}:${env.PORT}`)
    await addSlotCleanupJob()
    await addReminderJob()
    await addAbandonedBookingJob()
    await addSubscriptionLifecycleJob()
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
