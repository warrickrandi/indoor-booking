// Permission keys assigned to the system roles created for every new company.
// `owner` gets every seeded company_permission (fetched dynamically at registration
// time so this list never drifts from packages/db/prisma/seed.ts).

export const LOCATION_MANAGER_PERMISSIONS = [
  'locations.read',
  'sub_venues.write',
  'slots.read',
  'slots.write',
  'pricing.write',
  'bookings.read',
  'bookings.checkin',
  'bookings.cancel',
  'payments.read',
  'payments.verify_slip',
  'reports.daily',
  'notifications.send',
]

export const RECEPTIONIST_PERMISSIONS = [
  'locations.read',
  'slots.read',
  'bookings.read',
  'bookings.checkin',
  'bookings.cancel',
  'payments.read',
  'payments.verify_slip',
]
