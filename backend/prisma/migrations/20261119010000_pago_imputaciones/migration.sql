-- PagoImputacion: crédito de folio separado de la caja (Pago).
-- Backfill 1:1 desde Pago histórico. No cambia importes/saldos si se verifica post-deploy.

-- 1) Tabla de imputaciones
CREATE TABLE "PagoImputacion" (
    "id" SERIAL NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "reservaId" INTEGER,
    "montoARS" DECIMAL(10,2) NOT NULL,
    "bonificacionARS" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "ordenIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PagoImputacion_pkey" PRIMARY KEY ("id")
);

-- 2) Backfill 1 imputación por pago (accountId histórico obligatorio)
INSERT INTO "PagoImputacion" ("pagoId", "accountId", "reservaId", "montoARS", "bonificacionARS", "ordenIndex", "createdAt", "updatedAt")
SELECT
  p."id",
  p."accountId",
  p."reservaId",
  p."montoARS",
  COALESCE((
    SELECT SUM(d."montoARS")
    FROM "DiscountApplication" d
    WHERE d."pagoId" = p."id"
      AND d."montoARS" > 0
      AND d."activo" = true
  ), 0),
  0,
  p."createdAt",
  p."updatedAt"
FROM "Pago" p
WHERE p."accountId" IS NOT NULL;

-- 3) DiscountApplication: quitar unique de pagoId + FK a imputación
ALTER TABLE "DiscountApplication" DROP CONSTRAINT IF EXISTS "DiscountApplication_pagoId_key";

ALTER TABLE "DiscountApplication" ADD COLUMN "pagoImputacionId" INTEGER;

UPDATE "DiscountApplication" d
SET "pagoImputacionId" = i."id"
FROM "PagoImputacion" i
WHERE i."pagoId" = d."pagoId"
  AND i."accountId" = d."accountId";

-- Fallback: si account no matchea (raro), primera imputación del pago
UPDATE "DiscountApplication" d
SET "pagoImputacionId" = (
  SELECT i."id" FROM "PagoImputacion" i WHERE i."pagoId" = d."pagoId" ORDER BY i."id" ASC LIMIT 1
)
WHERE d."pagoImputacionId" IS NULL;

CREATE INDEX "DiscountApplication_pagoId_idx" ON "DiscountApplication"("pagoId");
CREATE INDEX "DiscountApplication_pagoImputacionId_idx" ON "DiscountApplication"("pagoImputacionId");

ALTER TABLE "DiscountApplication"
  ADD CONSTRAINT "DiscountApplication_pagoImputacionId_fkey"
  FOREIGN KEY ("pagoImputacionId") REFERENCES "PagoImputacion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Pago.accountId nullable + onDelete SetNull (deja de cascader caja al borrar folio)
ALTER TABLE "Pago" DROP CONSTRAINT IF EXISTS "Pago_accountId_fkey";
ALTER TABLE "Pago" DROP CONSTRAINT IF EXISTS "Pago_reservaId_fkey";

ALTER TABLE "Pago" ALTER COLUMN "accountId" DROP NOT NULL;

ALTER TABLE "Pago"
  ADD CONSTRAINT "Pago_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Pago"
  ADD CONSTRAINT "Pago_reservaId_fkey"
  FOREIGN KEY ("reservaId") REFERENCES "Reservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) FKs / índices PagoImputacion
CREATE UNIQUE INDEX "PagoImputacion_pagoId_accountId_key" ON "PagoImputacion"("pagoId", "accountId");
CREATE INDEX "PagoImputacion_accountId_idx" ON "PagoImputacion"("accountId");
CREATE INDEX "PagoImputacion_reservaId_idx" ON "PagoImputacion"("reservaId");
CREATE INDEX "PagoImputacion_pagoId_idx" ON "PagoImputacion"("pagoId");

ALTER TABLE "PagoImputacion"
  ADD CONSTRAINT "PagoImputacion_pagoId_fkey"
  FOREIGN KEY ("pagoId") REFERENCES "Pago"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PagoImputacion"
  ADD CONSTRAINT "PagoImputacion_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PagoImputacion"
  ADD CONSTRAINT "PagoImputacion_reservaId_fkey"
  FOREIGN KEY ("reservaId") REFERENCES "Reservation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
