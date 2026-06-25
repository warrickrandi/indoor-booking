-- CreateIndex
CREATE INDEX "time_slots_status_locked_until_idx" ON "time_slots"("status", "locked_until");

-- CreateIndex
CREATE INDEX "bookings_company_id_status_created_at_idx" ON "bookings"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_status_paid_at_idx" ON "payment_transactions"("status", "paid_at");
