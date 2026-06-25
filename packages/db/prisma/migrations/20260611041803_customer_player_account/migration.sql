-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_company_id_fkey";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ALTER COLUMN "company_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
