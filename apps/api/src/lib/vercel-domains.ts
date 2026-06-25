import { env } from './env.js'

const VERCEL_API = 'https://api.vercel.com'

function vercelConfigured(): boolean {
  return !!(env.VERCEL_TOKEN && env.VERCEL_PROJECT_ID)
}

function projectUrl(path: string): string {
  return `${VERCEL_API}/v9/projects/${env.VERCEL_PROJECT_ID}${path}`
}

export async function addDomainToVercel(domain: string): Promise<void> {
  if (!vercelConfigured()) {
    return
  }

  try {
    await fetch(projectUrl('/domains'), {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    })
  } catch (err) {
    console.error(`[vercel-domains] failed to add ${domain}:`, (err as Error).message)
  }
}

export async function removeDomainFromVercel(domain: string): Promise<void> {
  if (!vercelConfigured()) {
    return
  }

  try {
    await fetch(projectUrl(`/domains/${domain}`), {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
    })
  } catch (err) {
    console.error(`[vercel-domains] failed to remove ${domain}:`, (err as Error).message)
  }
}

export async function checkDomainSSL(domain: string): Promise<boolean> {
  if (!vercelConfigured()) {
    return false
  }

  try {
    const res = await fetch(projectUrl(`/domains/${domain}`), {
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
