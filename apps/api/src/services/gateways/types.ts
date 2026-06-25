import type { Prisma } from '@sports-booking/db'

export type BookingForCheckout = Prisma.BookingGetPayload<{
  include: { time_slot: { include: { sub_venue: true } }; customer: true }
}>

export type WebhookStatus = 'paid' | 'failed' | 'pending'
export type CheckoutPayload = Record<string, unknown>

export interface DriverConfig {
  credentials: Record<string, string>
}

export interface WebhookIds {
  bookingId: string | null
  gatewayOrderId: string | null
}

/**
 * Pluggable payment gateway contract (see root CLAUDE.md). `extractWebhookIds`
 * is an extension beyond the documented 3-method interface — it lets the
 * webhook dispatcher pull the booking id out of a raw payload before it knows
 * which venue's config to verify against.
 */
export interface GatewayDriver {
  readonly slug: string
  readonly name: string
  readonly isStub: boolean

  getCheckoutUrl(): string
  buildCheckoutPayload(booking: BookingForCheckout, config: DriverConfig): CheckoutPayload
  verifyWebhook(payload: Record<string, string>, config: DriverConfig): boolean
  parseWebhookStatus(payload: Record<string, string>): WebhookStatus
  extractWebhookIds(payload: Record<string, string>): WebhookIds
}
