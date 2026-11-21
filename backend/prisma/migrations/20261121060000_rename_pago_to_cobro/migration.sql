-- Rename dominio Pago → Cobro (cobro al cliente).
-- No ejecutar migrate deploy desde este agente; aplicar en notebook/ops con backup previo.

-- 1) Tablas principales
ALTER TABLE "Pago" RENAME TO "Cobro";
ALTER TABLE "PagoImputacion" RENAME TO "CobroImputacion";
ALTER TABLE "PagoAdjunto" RENAME TO "CobroAdjunto";
ALTER TABLE "PagoFactura" RENAME TO "CobroFactura";

-- 2) Columnas FK / self-ref en Cobro
ALTER TABLE "Cobro" RENAME COLUMN "pagoOrigenId" TO "cobroOrigenId";

-- 3) Columnas en tablas hijas / DA
ALTER TABLE "CobroImputacion" RENAME COLUMN "pagoId" TO "cobroId";
ALTER TABLE "CobroAdjunto" RENAME COLUMN "pagoId" TO "cobroId";
ALTER TABLE "CobroFactura" RENAME COLUMN "pagoId" TO "cobroId";
ALTER TABLE "DiscountApplication" RENAME COLUMN "pagoId" TO "cobroId";
ALTER TABLE "DiscountApplication" RENAME COLUMN "pagoImputacionId" TO "cobroImputacionId";
ALTER TABLE "DiscountApplication" RENAME COLUMN "monedaPago" TO "monedaCobro";

-- 4) Datos: motivo legacy 'Pago' → 'Cobro' (Seña / Devolución intactos)
UPDATE "Cobro" SET "motivo" = 'Cobro' WHERE "motivo" = 'Pago';
ALTER TABLE "Cobro" ALTER COLUMN "motivo" SET DEFAULT 'Cobro';

-- 5) Renombrar índices / constraints / sequences a nombres Prisma esperados
-- PKs
ALTER INDEX IF EXISTS "Pago_pkey" RENAME TO "Cobro_pkey";
ALTER INDEX IF EXISTS "PagoImputacion_pkey" RENAME TO "CobroImputacion_pkey";
ALTER INDEX IF EXISTS "PagoAdjunto_pkey" RENAME TO "CobroAdjunto_pkey";
ALTER INDEX IF EXISTS "PagoFactura_pkey" RENAME TO "CobroFactura_pkey";

-- Sequences (Postgres serial)
ALTER SEQUENCE IF EXISTS "Pago_id_seq" RENAME TO "Cobro_id_seq";
ALTER SEQUENCE IF EXISTS "PagoImputacion_id_seq" RENAME TO "CobroImputacion_id_seq";
ALTER SEQUENCE IF EXISTS "PagoAdjunto_id_seq" RENAME TO "CobroAdjunto_id_seq";
ALTER SEQUENCE IF EXISTS "PagoFactura_id_seq" RENAME TO "CobroFactura_id_seq";

-- Unique / indexes Cobro
ALTER INDEX IF EXISTS "Pago_codigo_key" RENAME TO "Cobro_codigo_key";
ALTER INDEX IF EXISTS "Pago_accountId_idx" RENAME TO "Cobro_accountId_idx";
ALTER INDEX IF EXISTS "Pago_reservaId_idx" RENAME TO "Cobro_reservaId_idx";
ALTER INDEX IF EXISTS "Pago_paymentMethodConfigId_idx" RENAME TO "Cobro_paymentMethodConfigId_idx";
ALTER INDEX IF EXISTS "Pago_pagoOrigenId_idx" RENAME TO "Cobro_cobroOrigenId_idx";

-- CobroImputacion
ALTER INDEX IF EXISTS "PagoImputacion_pagoId_accountId_key" RENAME TO "CobroImputacion_cobroId_accountId_key";
ALTER INDEX IF EXISTS "PagoImputacion_accountId_idx" RENAME TO "CobroImputacion_accountId_idx";
ALTER INDEX IF EXISTS "PagoImputacion_reservaId_idx" RENAME TO "CobroImputacion_reservaId_idx";
ALTER INDEX IF EXISTS "PagoImputacion_pagoId_idx" RENAME TO "CobroImputacion_cobroId_idx";

-- CobroAdjunto / CobroFactura
ALTER INDEX IF EXISTS "PagoAdjunto_pagoId_tipo_idx" RENAME TO "CobroAdjunto_cobroId_tipo_idx";
ALTER INDEX IF EXISTS "PagoFactura_pagoId_key" RENAME TO "CobroFactura_cobroId_key";

-- DiscountApplication
ALTER INDEX IF EXISTS "DiscountApplication_pagoId_idx" RENAME TO "DiscountApplication_cobroId_idx";
ALTER INDEX IF EXISTS "DiscountApplication_pagoImputacionId_idx" RENAME TO "DiscountApplication_cobroImputacionId_idx";

-- FK constraints (nombres)
ALTER TABLE "Cobro" RENAME CONSTRAINT "Pago_accountId_fkey" TO "Cobro_accountId_fkey";
ALTER TABLE "Cobro" RENAME CONSTRAINT "Pago_reservaId_fkey" TO "Cobro_reservaId_fkey";
ALTER TABLE "Cobro" RENAME CONSTRAINT "Pago_paymentMethodConfigId_fkey" TO "Cobro_paymentMethodConfigId_fkey";
ALTER TABLE "Cobro" RENAME CONSTRAINT "Pago_pagoOrigenId_fkey" TO "Cobro_cobroOrigenId_fkey";

ALTER TABLE "CobroImputacion" RENAME CONSTRAINT "PagoImputacion_pagoId_fkey" TO "CobroImputacion_cobroId_fkey";
ALTER TABLE "CobroImputacion" RENAME CONSTRAINT "PagoImputacion_accountId_fkey" TO "CobroImputacion_accountId_fkey";
ALTER TABLE "CobroImputacion" RENAME CONSTRAINT "PagoImputacion_reservaId_fkey" TO "CobroImputacion_reservaId_fkey";

ALTER TABLE "CobroAdjunto" RENAME CONSTRAINT "PagoAdjunto_pagoId_fkey" TO "CobroAdjunto_cobroId_fkey";
ALTER TABLE "CobroFactura" RENAME CONSTRAINT "PagoFactura_pagoId_fkey" TO "CobroFactura_cobroId_fkey";

ALTER TABLE "DiscountApplication" RENAME CONSTRAINT "DiscountApplication_pagoId_fkey" TO "DiscountApplication_cobroId_fkey";
ALTER TABLE "DiscountApplication" RENAME CONSTRAINT "DiscountApplication_pagoImputacionId_fkey" TO "DiscountApplication_cobroImputacionId_fkey";
