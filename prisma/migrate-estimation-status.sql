-- EstimationStatus: PROFORMA (brouillon) + QUOTE (devis officiel)
DO $$ BEGIN
  ALTER TYPE "EstimationStatus" ADD VALUE IF NOT EXISTS 'PROFORMA';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "EstimationStatus" ADD VALUE IF NOT EXISTS 'QUOTE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
