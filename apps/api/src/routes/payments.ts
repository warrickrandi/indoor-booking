import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  InitiatePaymentBodySchema,
  ListTransactionsQuerySchema,
  GatewaySlugParamSchema,
  GatewayConfigBodySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import {
  initiatePayment,
  handleGatewayWebhook,
  listTransactions,
  getTransaction,
  listAvailableGateways,
  getGatewayConfig,
  updateGatewayConfig,
} from '../services/payment.service.js'
import { handlePayhereBillingWebhook } from '../services/billing.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.post(
    '/initiate',
    {
      schema:     { body: zodToJsonSchema(InitiatePaymentBodySchema) },
      preHandler: [authMiddleware],
    },
    async (req, reply) => {
      const body = InitiatePaymentBodySchema.parse(req.body)
      const result = await initiatePayment(req.actor, body.booking_id)
      return reply.send({ data: result })
    },
  )

  fastify.post('/webhook/payhere', { config: { rateLimit: false } }, async (req, reply) => {
    try {
      await handleGatewayWebhook('payhere', req.body as Record<string, string>)
    } catch (error) {
      // Gateways retry on any non-200 response — always acknowledge receipt
      // and handle/log failures internally instead of triggering retries.
      fastify.log.error(error)
    }
    return reply.status(200).send()
  })

  fastify.post('/webhook/payhere-billing', { config: { rateLimit: false } }, async (req, reply) => {
    try {
      await handlePayhereBillingWebhook(req.body as Record<string, string>)
    } catch (error) {
      fastify.log.error(error)
    }
    return reply.status(200).send()
  })

  fastify.post('/webhook/:driverSlug', { config: { rateLimit: false } }, async (req, reply) => {
    const { driverSlug } = req.params as { driverSlug: string }
    try {
      await handleGatewayWebhook(driverSlug, req.body as Record<string, string>)
    } catch (error) {
      fastify.log.error(error)
    }
    return reply.status(200).send()
  })

  fastify.get(
    '/transactions',
    { preHandler: [authMiddleware, requirePermission('payments.read')] },
    async (req, reply) => {
      const query = ListTransactionsQuerySchema.parse(req.query)
      const result = await listTransactions(req.actor, query)
      return reply.send(result)
    },
  )

  fastify.get(
    '/transactions/:txId',
    { preHandler: [authMiddleware, requirePermission('payments.read')] },
    async (req, reply) => {
      const { txId } = req.params as { txId: string }
      const result = await getTransaction(req.actor, txId)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/gateways',
    { preHandler: [authMiddleware, requirePermission('payments.gateway_config')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const result = await listAvailableGateways(actor)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/gateway-config/:slug',
    { preHandler: [authMiddleware, requirePermission('payments.gateway_config')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { slug } = GatewaySlugParamSchema.parse(req.params)
      const result = await getGatewayConfig(actor, slug)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/gateway-config/:slug',
    {
      schema:     { body: zodToJsonSchema(GatewayConfigBodySchema) },
      preHandler: [authMiddleware, requirePermission('payments.gateway_config')],
    },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const { slug } = GatewaySlugParamSchema.parse(req.params)
      const body = GatewayConfigBodySchema.parse(req.body)
      const result = await updateGatewayConfig(actor, slug, body)
      return reply.send({ data: result })
    },
  )
}
