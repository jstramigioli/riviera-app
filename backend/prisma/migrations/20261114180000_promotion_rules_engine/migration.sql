-- Motor de promociones / descuentos (PGH-144)
-- Backup previo: riviera_v1_pre_promo_motor_*.dump
-- Solo riviera_v1; no db push / migrate reset.

CREATE TYPE "PromotionKind" AS ENUM ('PROMO', 'DESCUENTO');
CREATE TYPE "PromotionModality" AS ENUM ('AUTO', 'MANUAL', 'SUGERIDA');
CREATE TYPE "PromotionLayer" AS ENUM ('SETTLEMENT', 'RATE');
CREATE TYPE "PromotionStacking" AS ENUM ('EXCLUSIVE', 'STACKABLE', 'BEST_OF');
CREATE TYPE "PromotionBenefitType" AS ENUM ('PERCENT', 'FIXED', 'FIXED_PER_NIGHT');
CREATE TYPE "PromotionBenefitBase" AS ENUM ('DEBT_CANCELLED', 'RATE_NIGHT', 'LODGING_TOTAL', 'PAYMENT_RECEIVED');
CREATE TYPE "PromotionConditionType" AS ENUM (
  'DATE_RANGE',
  'MIN_NIGHTS',
  'MAX_NIGHTS',
  'ROOM_TYPE',
  'SERVICE_TYPE',
  'PAYMENT_METHOD',
  'OCCUPANCY_HOTEL_MAX',
  'OCCUPANCY_HOTEL_MIN'
);

ALTER TYPE "DiscountApplicationTipo" ADD VALUE IF NOT EXISTS 'PROMOTION';

CREATE TABLE "PromotionRule" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL DEFAULT 'DESCUENTO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "prioridad" INTEGER NOT NULL DEFAULT 100,
    "modality" "PromotionModality" NOT NULL DEFAULT 'AUTO',
    "layer" "PromotionLayer" NOT NULL DEFAULT 'SETTLEMENT',
    "stacking" "PromotionStacking" NOT NULL DEFAULT 'EXCLUSIVE',
    "stackingGroup" TEXT,
    "vigenteDesde" TIMESTAMP(3),
    "vigenteHasta" TIMESTAMP(3),
    "aplicaEnParcial" BOOLEAN NOT NULL DEFAULT true,
    "aplicaEnSeña" BOOLEAN NOT NULL DEFAULT true,
    "benefitType" "PromotionBenefitType" NOT NULL DEFAULT 'PERCENT',
    "benefitValue" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "benefitBase" "PromotionBenefitBase" NOT NULL DEFAULT 'DEBT_CANCELLED',
    "benefitCapARS" DECIMAL(12,2),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionRule_code_key" ON "PromotionRule"("code");
CREATE INDEX "PromotionRule_activo_prioridad_idx" ON "PromotionRule"("activo", "prioridad");
CREATE INDEX "PromotionRule_layer_modality_idx" ON "PromotionRule"("layer", "modality");
CREATE INDEX "PromotionRule_vigenteDesde_vigenteHasta_idx" ON "PromotionRule"("vigenteDesde", "vigenteHasta");

CREATE TABLE "PromotionCondition" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "type" "PromotionConditionType" NOT NULL,
    "params" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionCondition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionCondition_ruleId_idx" ON "PromotionCondition"("ruleId");
CREATE INDEX "PromotionCondition_type_idx" ON "PromotionCondition"("type");

ALTER TABLE "PromotionCondition"
  ADD CONSTRAINT "PromotionCondition_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "PromotionRule"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscountApplication" ADD COLUMN IF NOT EXISTS "promotionRuleId" INTEGER;
ALTER TABLE "DiscountApplication" ADD COLUMN IF NOT EXISTS "appliedRulesJson" JSONB;

CREATE INDEX IF NOT EXISTS "DiscountApplication_promotionRuleId_idx" ON "DiscountApplication"("promotionRuleId");

ALTER TABLE "DiscountApplication"
  ADD CONSTRAINT "DiscountApplication_promotionRuleId_fkey"
  FOREIGN KEY ("promotionRuleId") REFERENCES "PromotionRule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReservationNightRate" ADD COLUMN IF NOT EXISTS "promotionRuleId" INTEGER;
ALTER TABLE "ReservationNightRate" ADD COLUMN IF NOT EXISTS "promotionDiscountARS" DOUBLE PRECISION;
ALTER TABLE "ReservationNightRate" ADD COLUMN IF NOT EXISTS "promotionPercent" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "ReservationNightRate_promotionRuleId_idx" ON "ReservationNightRate"("promotionRuleId");

-- Migrar descuentos activos de PaymentMethodConfig → PromotionRule (Efectivo 10%, etc.)
INSERT INTO "PromotionRule" (
  "code", "label", "kind", "activo", "prioridad", "modality", "layer", "stacking",
  "aplicaEnParcial", "aplicaEnSeña", "benefitType", "benefitValue", "benefitBase",
  "notas", "createdAt", "updatedAt"
)
SELECT
  'PAYDISC_' || pmc."code",
  'Descuento ' || pmc."label",
  'DESCUENTO'::"PromotionKind",
  true,
  1000 - pmc."ordenIndex",
  'AUTO'::"PromotionModality",
  'SETTLEMENT'::"PromotionLayer",
  'EXCLUSIVE'::"PromotionStacking",
  pmc."aplicaEnParcial",
  pmc."aplicaEnSeña",
  CASE WHEN pmc."descuentoTipo"::text = 'FIXED' THEN 'FIXED'::"PromotionBenefitType" ELSE 'PERCENT'::"PromotionBenefitType" END,
  pmc."descuentoValor",
  'DEBT_CANCELLED'::"PromotionBenefitBase",
  'Migrado desde PaymentMethodConfig#' || pmc."id"::text,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PaymentMethodConfig" pmc
WHERE pmc."descuentoActivo" = true
  AND pmc."descuentoValor" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "PromotionRule" pr WHERE pr."code" = 'PAYDISC_' || pmc."code"
  );

INSERT INTO "PromotionCondition" ("ruleId", "type", "params", "createdAt", "updatedAt")
SELECT
  pr."id",
  'PAYMENT_METHOD'::"PromotionConditionType",
  jsonb_build_object('paymentMethodConfigId', pmc."id", 'paymentMethodCode', pmc."code"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PaymentMethodConfig" pmc
JOIN "PromotionRule" pr ON pr."code" = 'PAYDISC_' || pmc."code"
WHERE pmc."descuentoActivo" = true
  AND pmc."descuentoValor" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "PromotionCondition" pc
    WHERE pc."ruleId" = pr."id" AND pc."type" = 'PAYMENT_METHOD'
  );

-- Vincular aplicaciones históricas de medio de pago a la regla migrada (solo trazabilidad; no reescribe montos)
UPDATE "DiscountApplication" da
SET "promotionRuleId" = pr."id",
    "appliedRulesJson" = jsonb_build_array(
      jsonb_build_object(
        'promotionRuleId', pr."id",
        'code', pr."code",
        'label', pr."label",
        'montoARS', da."montoARS",
        'legacyTipo', da."tipo"
      )
    )
FROM "PaymentMethodConfig" pmc
JOIN "PromotionRule" pr ON pr."code" = 'PAYDISC_' || pmc."code"
WHERE da."paymentMethodConfigId" = pmc."id"
  AND da."promotionRuleId" IS NULL
  AND da."tipo" IN ('PAYMENT_METHOD', 'REVERSAL');
