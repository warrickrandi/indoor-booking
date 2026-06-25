import { generateKeyPairSync } from 'node:crypto'

export interface DkimKeyPair {
  /** PKCS#8 PEM — caller MUST encrypt before persisting, never store/log in plaintext. */
  privateKeyPem: string
  /** SPKI PEM — safe to expose. */
  publicKeyPem: string
  /** DNS TXT record value: "v=DKIM1; k=rsa; p={base64}". */
  dnsRecordValue: string
}

export function generateDkimKeyPair(): DkimKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    dnsRecordValue: buildDkimDnsRecordValue(publicKey),
  }
}

export function buildDkimDnsRecordValue(publicKeyPem: string): string {
  const base64 = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '')

  return `v=DKIM1; k=rsa; p=${base64}`
}

export function buildDkimRecordHostname(selector: string, domain: string): string {
  return `${selector}._domainkey.${domain}`
}
