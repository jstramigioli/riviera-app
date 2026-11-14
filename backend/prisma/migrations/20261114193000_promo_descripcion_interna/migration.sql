-- Descripción interna de staff en reglas de promo/descuento (ex-notas).
ALTER TABLE "PromotionRule" RENAME COLUMN "notas" TO "descripcionInterna";
