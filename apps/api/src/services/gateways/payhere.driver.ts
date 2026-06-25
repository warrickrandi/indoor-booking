import { createHash } from 'node:crypto'
import { env } from '../../lib/env.js'
import { formatLocalDate } from '../../lib/datetime.js'
import type { BookingForCheckout, CheckoutPayload, DriverConfig, GatewayDriver, WebhookStatus } from './types.js'

export const PayhereDriver: GatewayDriver = {
  slug: 'payhere',
  name: 'PayHere',
  isStub: false,

  getCheckoutUrl(): string {
    return 'https://www.payhere.lk/pay/checkout'
  },

  buildCheckoutPayload(booking: BookingForCheckout, config: DriverConfig): CheckoutPayload {
    const merchantId = config.credentials['merchant_id'] ?? ''
    const merchantSecret = config.credentials['merchant_secret'] ?? ''

    const amount = Number(booking.total_amount).toFixed(2)
    const currency = 'LKR'

    const hashedSecret = createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
    const hash = createHash('md5')
      .update(`${merchantId}${booking.booking_ref}${amount}${currency}${hashedSecret}`)
      .digest('hex')
      .toUpperCase()

    const nameParts = booking.customer.full_name.trim().split(/\s+/)
    const firstName = nameParts[0] || 'Customer'
    const lastName = nameParts.slice(1).join(' ')

    const dateStr = formatLocalDate(booking.time_slot.start_time)
    const timeStr = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Colombo',
    }).format(booking.time_slot.start_time)

    return {
      merchant_id: merchantId,
      return_url: `${env.FRONTEND_URL}/bookings/${booking.id}/payment-success`,
      cancel_url: `${env.FRONTEND_URL}/bookings/${booking.id}/payment-cancelled`,
      notify_url: `${env.API_URL}/api/v1/payments/webhook/payhere`,
      order_id: booking.booking_ref,
      items: `${booking.time_slot.sub_venue.name} - ${dateStr} ${timeStr}`,
      currency,
      amount,
      first_name: firstName,
      last_name: lastName,
      email: booking.customer.email ?? '',
      phone: booking.customer.phone ?? '',
      custom_1: booking.id,
      hash,
    }
  },

  verifyWebhook(payload: Record<string, string>, config: DriverConfig): boolean {
    const merchantSecret = config.credentials['merchant_secret'] ?? ''
    const hashedSecret = createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
    const localSig = createHash('md5')
      .update(
        `${payload['merchant_id'] ?? ''}${payload['order_id'] ?? ''}${payload['payhere_amount'] ?? ''}${payload['payhere_currency'] ?? ''}${payload['status_code'] ?? ''}${hashedSecret}`,
      )
      .digest('hex')
      .toUpperCase()

    return localSig === (payload['md5sig'] ?? '').toUpperCase()
  },

  parseWebhookStatus(payload: Record<string, string>): WebhookStatus {
    const statusCode = payload['status_code'] ?? ''
    if (statusCode === '2') return 'paid'
    if (statusCode === '0') return 'pending'
    return 'failed'
  },

  extractWebhookIds(payload: Record<string, string>) {
    return {
      bookingId: payload['custom_1'] ?? null,
      gatewayOrderId: payload['order_id'] ?? null,
    }
  },
}
