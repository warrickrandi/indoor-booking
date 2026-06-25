import type { FastifyInstance } from 'fastify'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  ListCompaniesQuerySchema,
  UpdateCompanySubscriptionBodySchema,
  UpdateSubscriptionPlanBodySchema,
  ListAuditLogsQuerySchema,
  ListAdminBookingsQuerySchema,
  UpdateGatewayDriverBodySchema,
  ListBillingInvoicesQuerySchema,
  CreateManualInvoiceBodySchema,
  MarkInvoicePaidBodySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePlatformAdmin } from '../middleware/rbac.js'
import { requirePlatformAdminActor } from '../lib/actor.js'
import {
  getAdminStats,
  listCompanies,
  getCompanyDetail,
  updateCompanySubscription,
  listSubscriptionPlans,
  updateSubscriptionPlan,
  listAuditLogs,
  listAdminBookings,
  listGatewayDrivers,
  updateGatewayDriver,
  listBillingInvoices,
  createManualInvoice,
  markInvoicePaid,
} from '../services/admin.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.get(
    '/stats',
    { preHandler: [authMiddleware, requirePlatformAdmin()] },
    async (_req, reply) => {
      const result = await getAdminStats()
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/companies',
    { preHandler: [authMiddleware, requirePlatformAdmin()] },
    async (req, reply) => {
      const query = ListCompaniesQuerySchema.parse(req.query)
      const result = await listCompanies(query)
      return reply.send(result)
    },
  )

  fastify.get(
    '/companies/:companyId',
    { preHandler: [authMiddleware, requirePlatformAdmin()] },
    async (req, reply) => {
      const { companyId } = req.params as { companyId: string }
      const result = await getCompanyDetail(companyId)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/companies/:companyId/subscription',
    {
      schema:     { body: zodToJsonSchema(UpdateCompanySubscriptionBodySchema) },
      preHandler: [authMiddleware, requirePlatformAdmin({ roles: ['super_admin'] })],
    },
    async (req, reply) => {
      const actor = requirePlatformAdminActor(req)
      const { companyId } = req.params as { companyId: string }
      const body = UpdateCompanySubscriptionBodySchema.parse(req.body)
      const result = await updateCompanySubscription(companyId, body, actor)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/subscription-plans',
    { preHandler: [authMiddleware, requirePlatformAdmin()] },
    async (_req, reply) => {
      const result = await listSubscriptionPlans()
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/subscription-plans/:planId',
    {
      schema:     { body: zodToJsonSchema(UpdateSubscriptionPlanBodySchema) },
      preHandler: [authMiddleware, requirePlatformAdmin({ roles: ['super_admin'] })],
    },
    async (req, reply) => {
      const actor = requirePlatformAdminActor(req)
      const { planId } = req.params as { planId: string }
      const body = UpdateSubscriptionPlanBodySchema.parse(req.body)
      const result = await updateSubscriptionPlan(planId, body, actor)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/audit-logs',
    { preHandler: [authMiddleware, requirePlatformAdmin()] },
    async (req, reply) => {
      const actor = requirePlatformAdminActor(req)
      const query = ListAuditLogsQuerySchema.parse(req.query)
      const result = await listAuditLogs(query, actor)
      return reply.send(result)
    },
  )

  fastify.get(
    '/bookings',
    { preHandler: [authMiddleware, requirePlatformAdmin()] },
    async (req, reply) => {
      const query = ListAdminBookingsQuerySchema.parse(req.query)
      const result = await listAdminBookings(query)
      return reply.send(result)
    },
  )

  fastify.get(
    '/gateway-drivers',
    { preHandler: [authMiddleware, requirePlatformAdmin()] },
    async (_req, reply) => {
      const result = await listGatewayDrivers()
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/gateway-drivers/:driverId',
    {
      schema:     { body: zodToJsonSchema(UpdateGatewayDriverBodySchema) },
      preHandler: [authMiddleware, requirePlatformAdmin({ roles: ['super_admin'] })],
    },
    async (req, reply) => {
      const actor = requirePlatformAdminActor(req)
      const { driverId } = req.params as { driverId: string }
      const body = UpdateGatewayDriverBodySchema.parse(req.body)
      const result = await updateGatewayDriver(driverId, body, actor)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/billing/invoices',
    { preHandler: [authMiddleware, requirePlatformAdmin()] },
    async (req, reply) => {
      const query = ListBillingInvoicesQuerySchema.parse(req.query)
      const result = await listBillingInvoices(query)
      return reply.send(result)
    },
  )

  fastify.post(
    '/billing/invoices',
    {
      schema:     { body: zodToJsonSchema(CreateManualInvoiceBodySchema) },
      preHandler: [authMiddleware, requirePlatformAdmin({ roles: ['super_admin'] })],
    },
    async (req, reply) => {
      const actor = requirePlatformAdminActor(req)
      const body = CreateManualInvoiceBodySchema.parse(req.body)
      const result = await createManualInvoice(body, actor)
      return reply.send({ data: result })
    },
  )

  fastify.put(
    '/billing/invoices/:invoiceId/mark-paid',
    {
      schema:     { body: zodToJsonSchema(MarkInvoicePaidBodySchema) },
      preHandler: [authMiddleware, requirePlatformAdmin({ roles: ['super_admin'] })],
    },
    async (req, reply) => {
      const actor = requirePlatformAdminActor(req)
      const { invoiceId } = req.params as { invoiceId: string }
      const body = MarkInvoicePaidBodySchema.parse(req.body)
      const result = await markInvoicePaid(invoiceId, body, actor)
      return reply.send({ data: result })
    },
  )
}
