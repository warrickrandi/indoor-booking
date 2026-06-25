-- CreateIndex
CREATE INDEX "payment_transactions_company_id_idx" ON "payment_transactions"("company_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");
