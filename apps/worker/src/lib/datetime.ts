import type { BillingCycle } from '@sports-booking/types'

/**
 * Sri Lanka (Asia/Colombo) is a fixed UTC+5:30 offset with no DST — see
 * apps/api/src/lib/datetime.ts for the full set of helpers this mirrors.
 */
const LOCATION_TZ_OFFSET_MINUTES = 330

/** Advances a date by one billing cycle (calendar month or year, UTC). */
export function addInterval(date: Date, cycle: BillingCycle): Date {
  const d = new Date(date)
  if (cycle === 'monthly') {
    d.setUTCMonth(d.getUTCMonth() + 1)
  } else {
    d.setUTCFullYear(d.getUTCFullYear() + 1)
  }
  return d
}

/** Formats a UTC instant as a `YYYY-MM-DD` calendar date in Asia/Colombo. */
export function formatLocalDate(date: Date): string {
  const local = new Date(date.getTime() + LOCATION_TZ_OFFSET_MINUTES * 60_000)
  const year  = local.getUTCFullYear()
  const month = String(local.getUTCMonth() + 1).padStart(2, '0')
  const day   = String(local.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Formats a UTC instant as `HH:MM` in Asia/Colombo. */
export function formatLocalTime(date: Date): string {
  const local = new Date(date.getTime() + LOCATION_TZ_OFFSET_MINUTES * 60_000)
  const hours = String(local.getUTCHours()).padStart(2, '0')
  const mins  = String(local.getUTCMinutes()).padStart(2, '0')
  return `${hours}:${mins}`
}

export function addDays(dateStr: string, days: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`) + days * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** Combines a `YYYY-MM-DD` date with a local (Asia/Colombo) minute-of-day into the UTC instant. */
export function localDateTimeToUtc(dateStr: string, minutesOfDay: number): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const utcMs =
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) +
    minutesOfDay * 60_000 -
    LOCATION_TZ_OFFSET_MINUTES * 60_000
  return new Date(utcMs)
}

/** UTC `[start, end)` range covering "tomorrow" in Asia/Colombo, relative to now. */
export function getTomorrowLocalUtcRange(): { start: Date; end: Date } {
  const todayLocal = formatLocalDate(new Date())
  const tomorrowLocal = addDays(todayLocal, 1)
  const dayAfterLocal = addDays(todayLocal, 2)
  return {
    start: localDateTimeToUtc(tomorrowLocal, 0),
    end:   localDateTimeToUtc(dayAfterLocal, 0),
  }
}
