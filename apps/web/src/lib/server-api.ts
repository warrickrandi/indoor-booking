import { notFound } from 'next/navigation'

import type { ApiMeta } from './api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

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
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null

  if (!res.ok) {
    if (res.status === 404) {
      notFound()
    }
    const errBody = (body ?? {}) as Partial<ApiErrorBody>
    throw new Error(errBody.error ?? 'Request failed')
  }

  return body as PublicApiResponse<T>
}
