import type { VenueStaffActor } from '@sports-booking/types'

const ACCESS_TOKEN_KEY = 'sb_access_token'
const REFRESH_TOKEN_KEY = 'sb_refresh_token'
const SESSION_COOKIE = 'sb_session'

export type DecodedVenueStaffToken = VenueStaffActor & { iat: number; exp: number }

export interface SessionTokens {
  access_token: string
  refresh_token: string
}

export function setSession({ access_token, refresh_token }: SessionTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
  document.cookie = `${SESSION_COOKIE}=1; path=/; samesite=lax`
}

export function setAccessToken(access_token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function decodeJwt(token: string): DecodedVenueStaffToken | null {
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
    return JSON.parse(json) as DecodedVenueStaffToken
  } catch {
    return null
  }
}
