-- Descuentos por medio de pago (PGH-135)
-- Backup previo: riviera_v1_pre_payment_discounts_*.dump

CREATE TYPE "PaymentDiscountTipo" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "DiscountApplicationTipo" AS ENUM ('PAYMENT_METHOD', 'MANUAL', 'REVERSAL');

CREATE TABLE "PaymentMethodConfig" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ordenIndex" INTEGER NOT NULL DEFAULT 0,
    "requiereFacturacion" BOOLEAN NOT NULL DEFAULT false,
    "descuentoActivo" BOOLEAN NOT NULL DEFAULT false,
    "descuentoTipo" "PaymentDiscountTipo" NOT NULL DEFAULT 'PERCENT',
    "descuentoValor" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "aplicaEnParcial" BOOLEAN NOT NULL DEFAULT true,
    "aplicaEnSeña" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentMethodConfig_code_key" ON "PaymentMethodConfig"("code");
CREATE INDEX "PaymentMethodConfig_activo_ordenIndex_idx" ON "PaymentMethodConfig"("activo", "ordenIndex");

CREATE TABLE "DiscountApplication" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "paymentMethodConfigId" INTEGER,
    "tipo" "DiscountApplicationTipo" NOT NULL DEFAULT 'PAYMENT_METHOD',
    "baseCalculoARS" DECIMAL(10,2) NOT NULL,
    "porcentaje" DECIMAL(10,4),
    "valorFijo" DECIMAL(10,2),
    "montoARS" DECIMAL(10,2) NOT NULL,
    "monedaPago" TEXT,
    "tipoCambio" DECIMAL(10,4),
    "reversoDeId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountApplication_pagoId_key" ON "DiscountApplication"("pagoId");
CREATE INDEX "DiscountApplication_accountId_idx" ON "DiscountApplication"("accountId");
CREATE INDEX "DiscountApplication_paymentMethodConfigId_idx" ON "DiscountApplication"("paymentMethodConfigId");
CREATE INDEX "DiscountApplication_reversoDeId_idx" ON "DiscountApplication"("reversoDeId");
CREATE INDEX "DiscountApplication_activo_idx" ON "DiscountApplication"("activo");

ALTER TABLE "Pago" ADD COLUMN "paymentMethodConfigId" INTEGER;
ALTER TABLE "Pago" ADD COLUMN "pagoOrigenId" INTEGER;

CREATE INDEX "Pago_paymentMethodConfigId_idx" ON "Pago"("paymentMethodConfigId");
CREATE INDEX "Pago_pagoOrigenId_idx" ON "Pago"("pagoOrigenId");

ALTER TABLE "DiscountApplication"
  ADD CONSTRAINT "DiscountApplication_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscountApplication"
  ADD CONSTRAINT "DiscountApplication_pagoId_fkey"
  FOREIGN KEY ("pagoId") REFERENCES "Pago"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscountApplication"
  ADD CONSTRAINT "DiscountApplication_paymentMethodConfigId_fkey"
  FOREIGN KEY ("paymentMethodConfigId") REFERENCES "PaymentMethodConfig"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiscountApplication"
  ADD CONSTRAINT "DiscountApplication_reversoDeId_fkey"
  FOREIGN KEY ("reversoDeId") REFERENCES "DiscountApplication"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Pago"
  ADD CONSTRAINT "Pago_paymentMethodConfigId_fkey"
  FOREIGN KEY ("paymentMethodConfigId") REFERENCES "PaymentMethodConfig"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Pago"
  ADD CONSTRAINT "Pago_pagoOrigenId_fkey"
  FOREIGN KEY ("pagoOrigenId") REFERENCES "Pago"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed medios (Efectivo 10%; resto 0). aplicaEnParcial/Seña = true.
INSERT INTO "PaymentMethodConfig"
  ("code", "label", "activo", "ordenIndex", "requiereFacturacion", "descuentoActivo", "descuentoTipo", "descuentoValor", "aplicaEnParcial", "aplicaEnSeña", "createdAt", "updatedAt")
VALUES
  ('EFECTIVO', 'Efectivo', true, 10, false, true, 'PERCENT', 10, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('TARJETA_DEBITO', 'Tarjeta Debito', true, 20, true, false, 'PERCENT', 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('TARJETA_CREDITO', 'Tarjeta Credito', true, 30, true, false, 'PERCENT', 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('TRANSFERENCIA', 'Transferencia', true, 40, true, false, 'PERCENT', 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('MERCADOPAGO', 'Mercadopago', true, 50, false, false, 'PERCENT', 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CUENTA_DNI', 'Cuenta DNI', true, 60, false, false, 'PERCENT', 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CHEQUE', 'Cheque', true, 70, false, false, 'PERCENT', 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('OTRO', 'Otro', true, 80, false, false, 'PERCENT', 0, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Backfill FK por label de metodo
UPDATE "Pago" p
SET "paymentMethodConfigId" = c."id"
FROM "PaymentMethodConfig" c
WHERE p."paymentMethodConfigId" IS NULL
  AND lower(trim(p."metodo")) = lower(trim(c."label"));
