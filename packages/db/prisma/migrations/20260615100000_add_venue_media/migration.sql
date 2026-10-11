-- CreateTable
CREATE TABLE "venue_media" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storage_key" TEXT,
    "caption" TEXT,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_media_company_id_display_order_idx" ON "venue_media"("company_id", "display_order");

-- AddForeignKey
ALTER TABLE "venue_media" ADD CONSTRAINT "venue_media_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

