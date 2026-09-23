-- ProductType + stock ADJUSTMENT + client address optional
DO $$ BEGIN
  CREATE TYPE "ProductType" AS ENUM ('MARCHANDISE', 'PRESTATION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "type" "ProductType" NOT NULL DEFAULT 'MARCHANDISE';

DO $$ BEGIN
  ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "reason" TEXT;

ALTER TABLE "customers"
  ALTER COLUMN "address" DROP NOT NULL;
