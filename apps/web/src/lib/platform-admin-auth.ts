import type { PlatformAdminActor } from '@sports-booking/types'

const ACCESS_TOKEN_KEY = 'sb_admin_access_token'
const SESSION_COOKIE = 'sb_admin_session'

export type DecodedAdminToken = PlatformAdminActor & { iat: number; exp: number }

export interface AdminSessionTokens {
  access_token: string
}

export function setAdminSession({ access_token }: AdminSessionTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
  document.cookie = `${SESSION_COOKIE}=1; path=/; samesite=lax`
}

export function getAdminAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function clearAdminSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function decodeAdminJwt(token: string): DecodedAdminToken | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    return JSON.parse(json) as DecodedAdminToken
  } catch {
    return null
  }
}
