import type { FastifyInstance } from 'fastify'
import {
  DailySummaryQuerySchema,
  RevenueReportQuerySchema,
  OccupancyReportQuerySchema,
  ExportReportQuerySchema,
} from '@sports-booking/types'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/rbac.js'
import { requireVenueStaff } from '../lib/actor.js'
import { getDailySummary, getRevenue, getOccupancy, streamExport } from '../services/reports.service.js'

export async function register(fastify: FastifyInstance) {
  fastify.get(
    '/daily-summary',
    { preHandler: [authMiddleware, requirePermission('reports.daily')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const query = DailySummaryQuerySchema.parse(req.query)
      const result = await getDailySummary(actor, query)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/revenue',
    { preHandler: [authMiddleware, requirePermission('reports.full_ledger', { minTier: 'pro' })] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const query = RevenueReportQuerySchema.parse(req.query)
      const result = await getRevenue(actor, query)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/occupancy',
    { preHandler: [authMiddleware, requirePermission('reports.daily')] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const query = OccupancyReportQuerySchema.parse(req.query)
      const result = await getOccupancy(actor, query)
      return reply.send({ data: result })
    },
  )

  fastify.get(
    '/export',
    { preHandler: [authMiddleware, requirePermission('reports.full_ledger', { minTier: 'pro' })] },
    async (req, reply) => {
      const actor = requireVenueStaff(req)
      const query = ExportReportQuerySchema.parse(req.query)
      const { stream, filename } = streamExport(actor, query)
      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', `attachment; filename="${filename}"`)
      return reply.send(stream)
    },
  )
}
