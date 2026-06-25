import { env } from './env.js'

const VERCEL_API = 'https://api.vercel.com'

function vercelConfigured(): boolean {
  return !!(env.VERCEL_TOKEN && env.VERCEL_PROJECT_ID)
}

export async function checkDomainSSL(domain: string): Promise<boolean> {
  if (!vercelConfigured()) {
    return false
  }

  try {
    const res = await fetch(`${VERCEL_API}/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${domain}`, {
      headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
    })

    if (!res.ok) {
      return false
    }

    const data = (await res.json()) as { verified?: boolean }
    return data.verified === true
  } catch (err) {
    console.error(`[vercel-domains] failed to check SSL for ${domain}:`, (err as Error).message)
    return false
  }
}
