import { ApiError, type ApiResponse, type ApiMeta } from './api'
import { getPlayerAccessToken, clearPlayerSession } from './player-auth'
import { usePlayerAuthStore } from '@/store/player-auth.store'

export { ApiError, type ApiResponse, type ApiMeta }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

interface ApiErrorBody {
  error: string
  code: string
  details?: Record<string, unknown>
}

export interface MpRequestOptions {
  requireAuth?: boolean
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function throwIfError(res: Response, body: unknown, options: MpRequestOptions): void {
  if (!res.ok) {
    const errBody = (body ?? {}) as Partial<ApiErrorBody>
    if (res.status === 401 && options.requireAuth) {
      clearPlayerSession()
      usePlayerAuthStore.getState().clear()
    }
    throw new ApiError(errBody.error ?? 'Request failed', errBody.code ?? 'UNKNOWN_ERROR', res.status, errBody.details)
  }
}

export async function mpFetch<T>(
  path: string,
  init: RequestInit = {},
  options: MpRequestOptions = {},
): Promise<ApiResponse<T>> {
  const token = getPlayerAccessToken()
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

export function mpGet<T>(path: string, options?: MpRequestOptions): Promise<ApiResponse<T>> {
  return mpFetch<T>(path, { method: 'GET' }, options)
}

export function mpPost<T>(path: string, body?: unknown, options?: MpRequestOptions): Promise<ApiResponse<T>> {
  return mpFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }, options)
}

export function mpPut<T>(path: string, body?: unknown, options?: MpRequestOptions): Promise<ApiResponse<T>> {
  return mpFetch<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }, options)
}

export async function mpUploadFile<T>(
  path: string,
  formData: FormData,
  options: MpRequestOptions = {},
): Promise<ApiResponse<T>> {
  const token = getPlayerAccessToken()
  const headers = new Headers()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData })
  const body = await parseBody(res)
  throwIfError(res, body, options)
  return body as ApiResponse<T>
}
