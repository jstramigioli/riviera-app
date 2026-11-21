-- Siempre aplica en parcial: se elimina el flag de UI/API/schema.
-- Descuentos SETTLEMENT sin grupo y con EXCLUSIVE (default histórico de Config)
-- pasan a STACKABLE para alinear Config con el comportamiento real de suma.
-- EXCLUSIVE/BEST_OF siguen vigentes cuando hay stackingGroup compartido.

UPDATE "PromotionRule"
SET stacking = 'STACKABLE'
WHERE layer = 'SETTLEMENT'
  AND stacking = 'EXCLUSIVE'
  AND "stackingGroup" IS NULL;

ALTER TABLE "PromotionRule" DROP COLUMN IF EXISTS "aplicaEnParcial";
ALTER TABLE "PaymentMethodConfig" DROP COLUMN IF EXISTS "aplicaEnParcial";
