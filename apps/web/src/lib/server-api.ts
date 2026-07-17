import { notFound } from 'next/navigation'

import type { ApiMeta } from './api'

// Use API_INTERNAL_URL for server-side fetches (127.0.0.1 avoids the Node.js
// IPv6-first resolution bug where fetch('localhost:...') tries ::1 before 127.0.0.1,
// causing ECONNREFUSED against a Fastify server bound to 0.0.0.0).
const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ''

interface PublicApiResponse<T> {
  data: T
  meta?: ApiMeta
}

interface ApiErrorBody {
  error: string
  code: string
  details?: Record<string, unknown>
}

export async function fetchPublic<T>(path: string): Promise<PublicApiResponse<T>> {
  if (!API_URL) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not configured. Set it in Vercel environment variables and redeploy.',
    )
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { cache: 'no-store' })
  } catch (err) {
    throw new Error(`API server is unreachable (${API_URL}): ${String(err)}`)
  }

  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error('Invalid response from API server')
    }
  }

  if (!res.ok) {
    if (res.status === 404) {
      notFound()
    }
    const errBody = (body ?? {}) as Partial<ApiErrorBody>
    throw new Error(errBody.error ?? 'Request failed')
  }

  return body as PublicApiResponse<T>
}
