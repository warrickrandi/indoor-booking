import { z } from 'zod'

export const EMAIL_CONFIG_MODES = ['platform', 'subdomain', 'custom_domain', 'custom_smtp'] as const

export type EmailConfigMode = (typeof EMAIL_CONFIG_MODES)[number]

export const UpdateEmailConfigBodySchema = z.object({
  mode:            z.enum(EMAIL_CONFIG_MODES),
  from_name:       z.string().min(1).optional(),
  from_address:    z.string().email().optional(),
  reply_to:        z.string().email().optional(),
  smtp_host:       z.string().min(1).optional(),
  smtp_port:       z.coerce.number().int().positive().optional(),
  smtp_user:       z.string().min(1).optional(),
  smtp_pass:       z.string().min(1).optional(),
  smtp_encryption: z.enum(['tls', 'ssl', 'none']).optional(),
  dkim_selector:   z.string().min(1).optional(),
})

export const TestEmailConfigBodySchema = z.object({
  to_address: z.string().email(),
})

export const GenerateDkimKeysBodySchema = z.object({
  selector: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'Selector must be alphanumeric (with - or _)')
    .max(63)
    .optional(),
})

export type UpdateEmailConfigBody  = z.infer<typeof UpdateEmailConfigBodySchema>
export type TestEmailConfigBody    = z.infer<typeof TestEmailConfigBodySchema>
export type GenerateDkimKeysBody   = z.infer<typeof GenerateDkimKeysBodySchema>
