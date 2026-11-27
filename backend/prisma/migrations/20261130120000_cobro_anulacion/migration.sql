-- Anular cobros en lugar de borrarlos: columnas nuevas, todas opcionales (no toca datos existentes).

-- AlterTable
ALTER TABLE "Cobro" ADD COLUMN IF NOT EXISTS "anuladoAt" TIMESTAMP(3);
ALTER TABLE "Cobro" ADD COLUMN IF NOT EXISTS "anuladoPorId" INTEGER;
ALTER TABLE "Cobro" ADD COLUMN IF NOT EXISTS "anuladoPorNombre" TEXT;
ALTER TABLE "Cobro" ADD COLUMN IF NOT EXISTS "motivoAnulacion" TEXT;
ALTER TABLE "Cobro" ADD COLUMN IF NOT EXISTS "anulacionSnapshot" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cobro_anuladoAt_idx" ON "Cobro"("anuladoAt");
