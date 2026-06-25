import 'fastify'
import type { Actor } from '@sports-booking/types'

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor
  }
}
