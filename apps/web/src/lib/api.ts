import { toast } from 'sonner'

import { getAccessToken, getRefreshToken, setAccessToken, clearSession } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export interface ApiMeta {
  page: number
  limit: number
  total: number
}

export interface ApiResponse<T> {
  data: T
  meta?: ApiMeta
}

interface ApiErrorBody {
  error: string
  code: string
  details?: Record<string, unknown>
}

export class ApiError extends Error {
  code: string
  details?: Record<string, unknown>
  status: number

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh_token = getRefreshToken()
  if (!refresh_token) return false

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    })
    if (!res.ok) return false

    const body = (await res.json()) as ApiResponse<{ access_token: string }>
    setAccessToken(body.data.access_token)
    return true
  } catch {
    return false
  }
}

function handleSessionExpired(): never {
  clearSession()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
  throw new ApiError('Session expired', 'UNAUTHORIZED', 401)
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError('Connection failed. Please try again.', 'NETWORK_ERROR', res.status)
  }
}

function throwIfError(res: Response, body: unknown): void {
  if (!res.ok) {
    const errBody = (body ?? {}) as Partial<ApiErrorBody>
    throw new ApiError(errBody.error ?? 'Request failed', errBody.code ?? 'UNKNOWN_ERROR', res.status, errBody.details)
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<ApiResponse<T>> {
  const token = getAccessToken()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401 && token && retry) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return apiFetch<T>(path, options, false)
    }
    handleSessionExpired()
  }

  const body = await parseBody(res)
  throwIfError(res, body)
  return body as ApiResponse<T>
}

export function get<T>(path: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(path, { method: 'GET' })
}

export function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
}

export function put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined })
}

export function del<T>(path: string): Promise<ApiResponse<T>> {
  return apiFetch<T>(path, { method: 'DELETE' })
}

export async function uploadFile<T>(path: string, formData: FormData, retry = true): Promise<ApiResponse<T>> {
  const token = getAccessToken()
  const headers = new Headers()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData })

  if (res.status === 401 && token && retry) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return uploadFile<T>(path, formData, false)
    }
    handleSessionExpired()
  }

  const body = await parseBody(res)
  throwIfError(res, body)
  return body as ApiResponse<T>
}

const TIER_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  elite: 'Elite',
}

export function showApiErrorToast(error: unknown): void {
  if (error instanceof ApiError) {
    const requiredTier = error.details?.['required_tier']
    if (error.code === 'FORBIDDEN' && typeof requiredTier === 'string') {
      toast.error(`Upgrade to ${TIER_LABELS[requiredTier] ?? requiredTier} required`, {
        description: error.message,
      })
      return
    }
    toast.error(error.message)
    return
  }
  toast.error('Something went wrong')
}
