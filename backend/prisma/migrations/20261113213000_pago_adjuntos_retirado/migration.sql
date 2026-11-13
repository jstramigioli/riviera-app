-- Retirado (no aplica a Transferencia en UI; default false)
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "retirado" BOOLEAN NOT NULL DEFAULT false;

-- Adjuntos de factura PDF o comprobante de transferencia
CREATE TABLE IF NOT EXISTS "PagoAdjunto" (
    "id" SERIAL NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoAdjunto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PagoAdjunto_pagoId_tipo_idx" ON "PagoAdjunto"("pagoId", "tipo");

ALTER TABLE "PagoAdjunto"
  DROP CONSTRAINT IF EXISTS "PagoAdjunto_pagoId_fkey";
ALTER TABLE "PagoAdjunto"
  ADD CONSTRAINT "PagoAdjunto_pagoId_fkey"
  FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
