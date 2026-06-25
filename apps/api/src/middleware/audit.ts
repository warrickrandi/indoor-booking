import { Prisma } from '@sports-booking/db'
import { prisma } from '../lib/prisma.js'

export interface CreateAuditLogParams {
  actor_id?: string | null
  actor_type?: string | null
  company_id?: string | null
  action: string
  entity_type?: string | null
  entity_id?: string | null
  before?: unknown
  after?: unknown
}

export async function createAuditLog(
  params: CreateAuditLogParams,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma
  const changes =
    params.before !== undefined || params.after !== undefined
      ? { before: params.before ?? null, after: params.after ?? null }
      : undefined

  await client.auditLog.create({
    data: {
      company_id:  params.company_id ?? null,
      actor_id:    params.actor_id ?? null,
      actor_type:  params.actor_type ?? null,
      action:      params.action,
      entity_type: params.entity_type ?? null,
      entity_id:   params.entity_id ?? null,
      changes:     changes as Prisma.InputJsonValue | undefined,
    },
  })
}
