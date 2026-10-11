import { prisma } from '../lib/prisma.js'

export interface PaymentOptions {
  /** Venue has its own active payment gateway configured. */
  online: boolean
  /** Venue has bank account details on file for slip uploads. */
  bank_transfer: boolean
  /** Always available — customer pays on arrival. */
  pay_at_venue: boolean
}

/** Which payment methods a venue currently offers customers. */
export async function getPaymentOptions(companyId: string): Promise<PaymentOptions> {
  const [activeGateway, billing] = await Promise.all([
    prisma.venuePaymentConfig.findFirst({
      where:  { company_id: companyId, is_active: true },
      select: { id: true },
    }),
    prisma.companyBilling.findUnique({
      where:  { company_id: companyId },
      select: { bank_name: true, bank_account_number: true },
    }),
  ])

  return {
    online:        activeGateway !== null,
    bank_transfer: Boolean(billing?.bank_name && billing.bank_account_number),
    pay_at_venue:  true,
  }
}
