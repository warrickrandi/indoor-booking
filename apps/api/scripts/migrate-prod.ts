/**
 * Pre-deploy step on Railway — applies pending Prisma migrations to the
 * production database. Run via: npx tsx apps/api/scripts/migrate-prod.ts
 */
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaPath = resolve(__dirname, '../../../packages/db/prisma/schema.prisma')

execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, { stdio: 'inherit' })
