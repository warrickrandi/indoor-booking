import { z } from 'zod'

export const VenueStaffActorSchema = z.object({
  sub:          z.string().uuid(),
  type:         z.literal('venue_staff'),
  company_id:   z.string().uuid(),
  role_key:     z.string(),
  tier:         z.enum(['basic', 'pro', 'elite']),
  location_ids: z.array(z.string().uuid()),
  permissions:  z.array(z.string()),
})

export const PlayerActorSchema = z.object({
  sub:   z.string().uuid(),
  type:  z.literal('player'),
  email: z.string().email(),
})

export const PlatformAdminActorSchema = z.object({
  sub:           z.string().uuid(),
  type:          z.literal('platform_admin'),
  platform_role: z.string(),
})

export type VenueStaffActor   = z.infer<typeof VenueStaffActorSchema>
export type PlayerActor        = z.infer<typeof PlayerActorSchema>
export type PlatformAdminActor = z.infer<typeof PlatformAdminActorSchema>
export type Actor = VenueStaffActor | PlayerActor | PlatformAdminActor
