-- AlterTable
ALTER TABLE "time_slots" ADD COLUMN     "pricing_rule_id" UUID,
ADD COLUMN     "rate_type" TEXT NOT NULL DEFAULT 'flat';

-- CreateIndex
CREATE INDEX "time_slots_pricing_rule_id_idx" ON "time_slots"("pricing_rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_sub_venue_id_start_time_key" ON "time_slots"("sub_venue_id", "start_time");

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
