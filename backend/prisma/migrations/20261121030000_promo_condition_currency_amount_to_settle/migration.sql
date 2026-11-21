-- PGH-325 / gaps UI vs Prisma P1: CURRENCY + AMOUNT_TO_SETTLE (UI/API/motor ya los usan).
-- Antes de migrate deploy: backup completo de riviera_v1.
-- Solo riviera_v1; no db push / migrate reset.
-- Patrón: 20261114192500_promo_condition_types_extend

ALTER TYPE "PromotionConditionType" ADD VALUE IF NOT EXISTS 'CURRENCY';
ALTER TYPE "PromotionConditionType" ADD VALUE IF NOT EXISTS 'AMOUNT_TO_SETTLE';
