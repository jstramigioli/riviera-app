-- AlterTable
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "montoOriginal" DECIMAL(10,2);
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "manualOverride" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: cargos existentes guardan su monto actual como original
UPDATE "Cargo"
SET "montoOriginal" = "monto"
WHERE "montoOriginal" IS NULL;
