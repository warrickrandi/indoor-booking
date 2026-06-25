/**
 * Concurrency test for slot locking — verifies the double-booking
 * prevention (Redis SET NX EX 600 + Postgres SELECT ... FOR UPDATE).
 *
 * Fires N simultaneous POST /slots/:slotId/lock requests for the same slot
 * and asserts exactly one succeeds.
 *
 * Run via:
 *   npx tsx apps/api/scripts/load-test-slots.ts <slotId> [concurrency]
 *
 * Examples:
 *   npx tsx apps/api/scripts/load-test-slots.ts <slotId>        # concurrency 10
 *   npx tsx apps/api/scripts/load-test-slots.ts <slotId> 50     # concurrency 50
 *
 * To test the post-expiry case: run once (slot becomes locked), wait for
 * locked_until to pass (10 minutes), then run again against the same slotId
 * — it should again show "Successful locks: 1".
 */

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001'

interface LockResult {
  index: number
  success: boolean
  data: unknown
}

async function testConcurrentLocking(slotId: string, concurrency: number): Promise<void> {
  const promises = Array.from({ length: concurrency }, (_, i) =>
    fetch(`${API_URL}/api/v1/slots/${slotId}/lock`, { method: 'POST' })
      .then((r) => r.json())
      .then((d): LockResult => ({ index: i, success: !d.error, data: d })),
  )

  const results = await Promise.all(promises)
  const successes = results.filter((r) => r.success)
  const failures = results.filter((r) => !r.success)

  console.log(`Concurrency: ${concurrency}`)
  console.log(`Successful locks: ${successes.length} (expected: 1)`)
  console.log(`Rejected: ${failures.length} (expected: ${concurrency - 1})`)

  if (successes.length !== 1) {
    console.error('DOUBLE BOOKING VULNERABILITY DETECTED')
    process.exit(1)
  }

  console.log('PASS: Only one lock succeeded')
  console.log(`Winning request index: ${successes[0]!.index}`)
  console.log('Lock result:', JSON.stringify(successes[0]!.data))
}

const slotId = process.argv[2]
if (!slotId) {
  console.error('Provide slotId as argument')
  console.error('Usage: npx tsx apps/api/scripts/load-test-slots.ts <slotId> [concurrency]')
  process.exit(1)
}

const concurrency = process.argv[3] ? Number(process.argv[3]) : 10
if (!Number.isInteger(concurrency) || concurrency < 1) {
  console.error('concurrency must be a positive integer')
  process.exit(1)
}

testConcurrentLocking(slotId, concurrency).catch((err) => {
  console.error('load-test-slots: failed to run', err)
  process.exitCode = 1
})
