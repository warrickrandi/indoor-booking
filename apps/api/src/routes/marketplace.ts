import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { CustomerRegisterBodySchema, CustomerLoginBodySchema, MarketplaceVenuesQuerySchema, MarketplaceResolveDomainQuerySchema } from '@sports-booking/types'
import { registerCustomer, loginCustomer, listVenues, getVenueBySlug, resolveDomainByHost } from '../services/marketplace.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.post(
    '/customers/register',
    { schema: { body: zodToJsonSchema(CustomerRegisterBodySchema) } },
    async (req, reply) => {
      const body = CustomerRegisterBodySchema.parse(req.body)
      const result = await registerCustomer(body)
      return reply.send({ data: result })
    },
  )

  fastify.post(
    '/customers/login',
    { schema: { body: zodToJsonSchema(CustomerLoginBodySchema) } },
    async (req, reply) => {
      const body = CustomerLoginBodySchema.parse(req.body)
      const result = await loginCustomer(body)
      return reply.send({ data: result })
    },
  )

  fastify.get('/venues', async (req, reply) => {
    const query = MarketplaceVenuesQuerySchema.parse(req.query)
    const result = await listVenues(query)
    return reply.send(result)
  })

  fastify.get('/venues/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const result = await getVenueBySlug(slug)
    return reply.send({ data: result })
  })

  fastify.get('/resolve-domain', async (req, reply) => {
    const query = MarketplaceResolveDomainQuerySchema.parse(req.query)
    const result = await resolveDomainByHost(query.host)
    return reply.send({ data: result })
  })
}
