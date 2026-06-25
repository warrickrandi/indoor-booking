-- DropIndex
DROP INDEX "bookings_time_slot_id_key";

-- DropIndex
DROP INDEX "payment_transactions_gateway_ref_idx";

-- AlterTable
ALTER TABLE "bank_transfer_verifications" DROP COLUMN "notes",
DROP COLUMN "slip_url",
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "slip_image_url" TEXT NOT NULL,
ADD COLUMN     "transfer_ref" TEXT;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "booking_ref" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "payment_transactions" DROP COLUMN "gateway_payload",
DROP COLUMN "gateway_ref",
ADD COLUMN     "gateway_order_id" TEXT,
ADD COLUMN     "gateway_response" JSONB,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "venue_payment_config_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_ref_key" ON "bookings"("booking_ref");

-- CreateIndex
CREATE INDEX "bookings_time_slot_id_idx" ON "bookings"("time_slot_id");

-- CreateIndex
CREATE INDEX "payment_transactions_gateway_order_id_idx" ON "payment_transactions"("gateway_order_id");

-- CreateIndex
CREATE INDEX "payment_transactions_venue_payment_config_id_idx" ON "payment_transactions"("venue_payment_config_id");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_venue_payment_config_id_fkey" FOREIGN KEY ("venue_payment_config_id") REFERENCES "venue_payment_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
