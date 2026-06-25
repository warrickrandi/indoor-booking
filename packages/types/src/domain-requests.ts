import { z } from 'zod'

export const AddDomainBodySchema = z.object({
  domain: z.string()
    .min(3)
    .max(253)
    .regex(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i, 'Invalid domain format')
    .transform((d) => d.toLowerCase()),
})

export type AddDomainBody = z.infer<typeof AddDomainBodySchema>
