import { z } from 'zod'

const EnvSchema = z.object({
  NEXT_PUBLIC_API_URL:         z.string().url(),
  NEXT_PUBLIC_PLATFORM_DOMAIN: z.string().min(1),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', parsed.error.flatten().fieldErrors)
  throw new Error('Missing or invalid environment variables — see above')
}

export const env = parsed.data
