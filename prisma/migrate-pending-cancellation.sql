ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PENDING_CANCELLATION';

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelRequestedById" INTEGER;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_cancelRequestedById_fkey'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_cancelRequestedById_fkey"
      FOREIGN KEY ("cancelRequestedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
