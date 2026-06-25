import { ApiError, type ApiResponse, type ApiMeta } from './api'
import { getAdminAccessToken, clearAdminSession } from './platform-admin-auth'
import { usePlatformAdminAuthStore } from '@/store/platform-admin-auth.store'

export { ApiError, type ApiResponse, type ApiMeta }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

interface ApiErrorBody {
  error: string
  code: string
  details?: Record<string, unknown>
}

export interface AdminRequestOptions {
  requireAuth?: boolean
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function throwIfError(res: Response, body: unknown, options: AdminRequestOptions): void {
  if (!res.ok) {
    const errBody = (body ?? {}) as Partial<ApiErrorBody>
    if (res.status === 401 && options.requireAuth) {
      clearAdminSession()
      usePlatformAdminAuthStore.getState().clear()
    }
    throw new ApiError(errBody.error ?? 'Request failed', errBody.code ?? 'UNKNOWN_ERROR', res.status, errBody.details)
  }
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  options: AdminRequestOptions = {},
): Promise<ApiResponse<T>> {
  const token = getAdminAccessToken()
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  const body = await parseBody(res)
  throwIfError(res, body, options)
  return body as ApiResponse<T>
}

export function adminGet<T>(path: string, options?: AdminRequestOptions): Promise<ApiResponse<T>> {
  return adminFetch<T>(path, { method: 'GET' }, options)
}

export function adminPost<T>(path: string, body?: unknown, options?: AdminRequestOptions): Promise<ApiResponse<T>> {
  return adminFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }, options)
}

export function adminPut<T>(path: string, body?: unknown, options?: AdminRequestOptions): Promise<ApiResponse<T>> {
  return adminFetch<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }, options)
}
