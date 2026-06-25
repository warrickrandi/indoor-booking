export const TEMPLATE_KEYS = [
  'booking_confirmed',
  'booking_cancelled',
  'payment_pending',
  'slip_approved',
  'slip_rejected',
  'booking_reminder',
  'welcome_player',
  'welcome_owner',
  'password_reset',
  'staff_invite',
  'domain_live',
  'subscription_invoice',
  'subscription_confirmed',
  'subscription_cancelled',
  'subscription_expired',
  'trial_expiring',
] as const

export type TemplateKey = (typeof TEMPLATE_KEYS)[number]
