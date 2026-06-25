import 'dotenv/config'
import { emailWorker } from './jobs/email.worker.js'
import { reminderWorker } from './jobs/reminder.worker.js'
import { slotCleanupWorker } from './jobs/slot-cleanup.worker.js'
import { abandonedBookingWorker } from './jobs/abandoned-booking.worker.js'
import { domainSslWorker } from './jobs/domain-ssl.worker.js'
import { subscriptionLifecycleWorker } from './jobs/subscription.worker.js'

console.log('Worker starting...')

emailWorker.on('ready', () => {
  console.log('Worker started')
})

reminderWorker.on('ready', () => {
  console.log('Booking reminder worker started')
})

slotCleanupWorker.on('ready', () => {
  console.log('Slot cleanup worker started')
})

abandonedBookingWorker.on('ready', () => {
  console.log('Abandoned booking cleanup worker started')
})

domainSslWorker.on('ready', () => {
  console.log('Domain SSL check worker started')
})

subscriptionLifecycleWorker.on('ready', () => {
  console.log('Subscription lifecycle worker started')
})

process.on('SIGTERM', () => {
  console.log('Worker shutting down...')
  void emailWorker.close()
  void reminderWorker.close()
  void slotCleanupWorker.close()
  void abandonedBookingWorker.close()
  void domainSslWorker.close()
  void subscriptionLifecycleWorker.close()
  process.exit(0)
})
