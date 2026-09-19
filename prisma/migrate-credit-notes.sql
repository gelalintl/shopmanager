CREATE TABLE IF NOT EXISTS "credit_notes" (
  "id" BIGSERIAL PRIMARY KEY,
  "publicId" TEXT NOT NULL UNIQUE,
  "companyId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "fiscalYear" INTEGER NOT NULL,
  "amount" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "restock" BOOLEAN NOT NULL DEFAULT FALSE,
  "invoiceId" BIGINT NOT NULL,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "credit_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_companyId_fiscalYear_code_key"
  ON "credit_notes"("companyId", "fiscalYear", "code");
CREATE INDEX IF NOT EXISTS "credit_notes_publicId_idx" ON "credit_notes"("publicId");
CREATE INDEX IF NOT EXISTS "credit_notes_companyId_invoiceId_idx" ON "credit_notes"("companyId", "invoiceId");
