-- AlterTable
ALTER TABLE "company_email_configs"
ALTER COLUMN "smtp_host" DROP NOT NULL,
ALTER COLUMN "smtp_port" DROP NOT NULL,
ALTER COLUMN "smtp_user" DROP NOT NULL,
ALTER COLUMN "smtp_password_encrypted" DROP NOT NULL,
ALTER COLUMN "from_address" DROP NOT NULL,
ALTER COLUMN "from_name" DROP NOT NULL,
DROP COLUMN "is_verified",
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'platform',
ADD COLUMN     "smtp_encryption" TEXT NOT NULL DEFAULT 'tls',
ADD COLUMN     "reply_to" TEXT,
ADD COLUMN     "dkim_selector" TEXT,
ADD COLUMN     "spf_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dkim_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dmarc_verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN     "booking_id" UUID,
ADD COLUMN     "message_id" TEXT;

-- AlterTable
ALTER TABLE "company_billing" ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "bank_account_name" TEXT,
ADD COLUMN     "bank_account_number" TEXT,
ADD COLUMN     "bank_branch" TEXT;

-- CreateIndex
CREATE INDEX "email_logs_booking_id_idx" ON "email_logs"("booking_id");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
