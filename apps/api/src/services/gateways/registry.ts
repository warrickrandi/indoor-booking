import type { GatewayDriver } from './types.js'
import { PayhereDriver } from './payhere.driver.js'
import { WebXPayDriver } from './webxpay.driver.js'
import { DirectPayDriver } from './directpay.driver.js'

const DRIVERS: Record<string, GatewayDriver> = {
  payhere: PayhereDriver,
  webxpay: WebXPayDriver,
  directpay: DirectPayDriver,
}

export function getGatewayDriver(slug: string): GatewayDriver | undefined {
  return DRIVERS[slug]
}

export function listDriverSlugs(): string[] {
  return Object.keys(DRIVERS)
}

export type { GatewayDriver, DriverConfig, CheckoutPayload, WebhookStatus, BookingForCheckout, WebhookIds } from './types.js'
