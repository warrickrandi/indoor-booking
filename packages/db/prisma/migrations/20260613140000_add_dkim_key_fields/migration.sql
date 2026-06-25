-- Add DKIM key-pair storage to company_email_configs.
-- Private key is AES-256-GCM encrypted at rest (see apps/api/src/lib/encrypt.ts);
-- only the public key is ever returned by the API.
ALTER TABLE "company_email_configs" ADD COLUMN "dkim_private_key_encrypted" TEXT;
ALTER TABLE "company_email_configs" ADD COLUMN "dkim_public_key" TEXT;
