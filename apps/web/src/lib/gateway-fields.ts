export interface GatewayCredentialField {
  key: string
  label: string
  type: 'text' | 'password'
  required: boolean
}

export const GATEWAY_CREDENTIAL_FIELDS: Record<string, GatewayCredentialField[]> = {
  payhere: [
    { key: 'merchant_id', label: 'Merchant ID', type: 'text', required: true },
    { key: 'merchant_secret', label: 'Merchant Secret', type: 'password', required: true },
    { key: 'app_id', label: 'App ID (optional)', type: 'text', required: false },
    { key: 'app_secret', label: 'App Secret (optional)', type: 'password', required: false },
  ],
  webxpay: [],
  directpay: [],
}
