-- Motivo del cobro a nivel Pago: Seña | Pago (default Pago)
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "motivo" TEXT NOT NULL DEFAULT 'Pago';

-- Backfill desde snapshot de factura si el texto ya era Seña/Pago
UPDATE "Pago" AS p
SET "motivo" = CASE
  WHEN lower(trim(f."motivo")) IN ('seña', 'sena') THEN 'Seña'
  WHEN lower(trim(f."motivo")) = 'pago' THEN 'Pago'
  ELSE p."motivo"
END
FROM "PagoFactura" AS f
WHERE f."pagoId" = p."id"
  AND f."motivo" IS NOT NULL
  AND trim(f."motivo") <> '';
