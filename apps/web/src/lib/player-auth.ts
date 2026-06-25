import type { PlayerActor } from '@sports-booking/types'

const ACCESS_TOKEN_KEY = 'sb_player_access_token'
const SESSION_COOKIE = 'sb_player_session'

export type DecodedPlayerToken = PlayerActor & { iat: number; exp: number }

export interface PlayerSessionTokens {
  access_token: string
}

export function setPlayerSession({ access_token }: PlayerSessionTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
  document.cookie = `${SESSION_COOKIE}=1; path=/; samesite=lax`
}

export function setPlayerAccessToken(access_token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
}

export function getPlayerAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function clearPlayerSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function decodePlayerJwt(token: string): DecodedPlayerToken | null {
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
    return JSON.parse(json) as DecodedPlayerToken
  } catch {
    return null
  }
}
