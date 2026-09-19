DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RoleName')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING (
      CASE
        WHEN "role"::text IN ('ADMIN', 'TENANT_SUPERADMIN') THEN 'ADMIN'::"UserRole"
        WHEN "role"::text = 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"UserRole"
        ELSE 'USER'::"UserRole"
      END
    );
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole";
    DROP TYPE "RoleName";
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelledById" INTEGER;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "cancelledById" INTEGER;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "cancelledById" INTEGER;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_cancelledById_fkey'
  ) THEN
    ALTER TABLE "invoices"
      ADD CONSTRAINT "invoices_cancelledById_fkey"
      FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collections_cancelledById_fkey'
  ) THEN
    ALTER TABLE "collections"
      ADD CONSTRAINT "collections_cancelledById_fkey"
      FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_cancelledById_fkey'
  ) THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_cancelledById_fkey"
      FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
