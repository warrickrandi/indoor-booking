import type { BookingForCheckout, CheckoutPayload, DriverConfig, GatewayDriver, WebhookStatus } from './types.js'

// TODO: WebXPay integration is UNIMPLEMENTED — undocumented gateway API at
// the time of writing. Seeded as is_active=false. Do not activate without
// implementing real checkout + signature verification and a security review.
export const WebXPayDriver: GatewayDriver = {
  slug: 'webxpay',
  name: 'WebXPay',
  isStub: true,

  getCheckoutUrl(): string {
    return 'https://stub.webxpay.example/checkout' // TODO: real hosted checkout URL
  },

  buildCheckoutPayload(booking: BookingForCheckout, _config: DriverConfig): CheckoutPayload {
    console.warn(`[WebXPayDriver] STUB buildCheckoutPayload for booking ${booking.id} — not implemented`)
    return {
      isStub: true,
      booking_id: booking.id,
      amount: Number(booking.total_amount).toFixed(2),
      currency: 'LKR',
    }
  },

  verifyWebhook(_payload: Record<string, string>, _config: DriverConfig): boolean {
    console.warn('[WebXPayDriver] STUB verifyWebhook — returning false (rejecting webhook). TODO: implement.')
    return false // SECURITY: never accept an unverified payment from a stub driver
  },

  parseWebhookStatus(_payload: Record<string, string>): WebhookStatus {
    console.warn('[WebXPayDriver] STUB parseWebhookStatus — returning "pending". TODO: implement.')
    return 'pending'
  },

  extractWebhookIds(_payload: Record<string, string>) {
    console.warn('[WebXPayDriver] STUB extractWebhookIds — returning nulls. TODO: implement.')
    return { bookingId: null, gatewayOrderId: null }
  },
}
