-- Descuentos SETTLEMENT siempre suman: stacking fijo STACKABLE, sin grupo.
-- Los campos stacking/stackingGroup se conservan para PROMO (RATE).

UPDATE "PromotionRule"
SET stacking = 'STACKABLE',
    "stackingGroup" = NULL
WHERE layer = 'SETTLEMENT';
