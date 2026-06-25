/**
 * Sri Lanka (Asia/Colombo) is a fixed UTC+5:30 offset with no DST, and is the
 * only timezone Phase 1 needs to support — so slot generation/display uses
 * manual offset arithmetic instead of pulling in a date-time library.
 */
const LOCATION_TZ_OFFSET_MINUTES = 330

export function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24
  const mins  = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
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

export function getDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60_000)
}

export function getTodayLocalDateString(): string {
  return formatLocalDate(new Date())
}

export function addDays(dateStr: string, days: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`) + days * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`)
  const toMs   = Date.parse(`${to}T00:00:00Z`)
  return Math.round((toMs - fromMs) / 86_400_000)
}

/** 0 (Sunday) – 6 (Saturday), matching `OperatingHour.day_of_week` / `PricingRule.applicable_days`. */
export function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay()
}
