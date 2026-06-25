import { z } from 'zod'

export const UpdateCompanyBodySchema = z.object({
  name:    z.string().min(1).optional(),
  slug:    z.string().min(1).optional(),
  phone:   z.string().min(1).optional(),
  address: z.string().min(1).optional(),
})

export const UpdateBrandingBodySchema = z.object({
  logo_url:          z.string().url().optional(),
  primary_color:     z.string().min(1).optional(),
  secondary_color:   z.string().min(1).optional(),
  favicon_url:       z.string().url().optional(),
  meta_title:        z.string().min(1).optional(),
  meta_description:  z.string().min(1).optional(),
})

export const InviteMemberBodySchema = z.object({
  email:        z.string().email(),
  role_key:     z.enum(['location_manager', 'receptionist']),
  location_ids: z.array(z.string().uuid()).optional(),
})

export const UpdateMemberBodySchema = z.object({
  role_key:     z.enum(['location_manager', 'receptionist']).optional(),
  location_ids: z.array(z.string().uuid()).optional(),
})

export type UpdateCompanyBody  = z.infer<typeof UpdateCompanyBodySchema>
export type UpdateBrandingBody = z.infer<typeof UpdateBrandingBodySchema>
export type InviteMemberBody   = z.infer<typeof InviteMemberBodySchema>
export type UpdateMemberBody   = z.infer<typeof UpdateMemberBodySchema>
