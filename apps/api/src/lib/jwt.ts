import jwt from 'jsonwebtoken'
import type { VenueStaffActor, PlayerActor, PlatformAdminActor } from '@sports-booking/types'
import { env } from './env.js'

export function signVenueStaffToken(payload: Omit<VenueStaffActor, 'type'>): string {
  return jwt.sign({ ...payload, type: 'venue_staff' }, env.VENUE_JWT_SECRET, { expiresIn: '15m' })
}

export function signVenueRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'venue_staff' }, env.VENUE_JWT_SECRET, { expiresIn: '7d' })
}

export function signPlayerToken(payload: Omit<PlayerActor, 'type'>): string {
  return jwt.sign({ ...payload, type: 'player' }, env.PLAYER_JWT_SECRET, { expiresIn: '24h' })
}

export function signPlayerRefreshToken(customerId: string): string {
  return jwt.sign({ sub: customerId, type: 'player' }, env.PLAYER_JWT_SECRET, { expiresIn: '7d' })
}

export function signPlatformAdminToken(payload: Omit<PlatformAdminActor, 'type'>): string {
  return jwt.sign({ ...payload, type: 'platform_admin' }, env.PLATFORM_JWT_SECRET, { expiresIn: '15m' })
}
