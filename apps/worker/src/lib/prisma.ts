import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { PrismaClient } from '@sports-booking/db'

loadEnv({ path: resolve(process.cwd(), '.env'), override: false })
loadEnv({ path: resolve(process.cwd(), '../../.env'), override: false })

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  })

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma
}
