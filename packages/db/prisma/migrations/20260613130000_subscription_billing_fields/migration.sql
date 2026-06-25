-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN "trial_period_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "scheduled_plan_id" UUID;
ALTER TABLE "companies" ADD COLUMN "trial_used_at" TIMESTAMP(3);
ALTER TABLE "companies" ADD CONSTRAINT "companies_scheduled_plan_id_fkey"
  FOREIGN KEY ("scheduled_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "company_domains" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
