/*
  Warnings:

  - You are about to drop the column `reason` on the `location_holidays` table. All the data in the column will be lost.
  - You are about to drop the column `day_type` on the `pricing_rules` table. All the data in the column will be lost.
  - You are about to drop the column `end_time` on the `pricing_rules` table. All the data in the column will be lost.
  - You are about to drop the column `start_time` on the `pricing_rules` table. All the data in the column will be lost.
  - Added the required column `label` to the `location_holidays` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "address" TEXT,
ADD COLUMN     "billing_cycle" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "company_branding" ADD COLUMN     "meta_description" TEXT,
ADD COLUMN     "meta_title" TEXT;

-- AlterTable
ALTER TABLE "location_holidays" DROP COLUMN "reason",
ADD COLUMN     "custom_close" TEXT,
ADD COLUMN     "custom_open" TEXT,
ADD COLUMN     "full_day" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "label" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pricing_rules" DROP COLUMN "day_type",
DROP COLUMN "end_time",
DROP COLUMN "start_time",
ADD COLUMN     "applicable_days" JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
ADD COLUMN     "peak_end" TEXT,
ADD COLUMN     "peak_start" TEXT,
ADD COLUMN     "rate_type" TEXT NOT NULL DEFAULT 'flat',
ADD COLUMN     "valid_from" DATE,
ADD COLUMN     "valid_until" DATE;

-- AlterTable
ALTER TABLE "sub_venues" ADD COLUMN     "description" TEXT,
ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0;
