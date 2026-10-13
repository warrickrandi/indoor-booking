-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "recurring_request_id" UUID;

-- CreateTable
CREATE TABLE "recurring_booking_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "sub_venue_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'player',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_booking_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_recurring_request_id_idx" ON "bookings"("recurring_request_id");

-- CreateIndex
CREATE INDEX "recurring_booking_requests_company_id_status_created_at_idx" ON "recurring_booking_requests"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "recurring_booking_requests_customer_id_idx" ON "recurring_booking_requests"("customer_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_recurring_request_id_fkey" FOREIGN KEY ("recurring_request_id") REFERENCES "recurring_booking_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_booking_requests" ADD CONSTRAINT "recurring_booking_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_booking_requests" ADD CONSTRAINT "recurring_booking_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_booking_requests" ADD CONSTRAINT "recurring_booking_requests_sub_venue_id_fkey" FOREIGN KEY ("sub_venue_id") REFERENCES "sub_venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_booking_requests" ADD CONSTRAINT "recurring_booking_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
