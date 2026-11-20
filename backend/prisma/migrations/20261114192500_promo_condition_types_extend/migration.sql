-- PGH-165: tipos de condición usados por UI/motor que faltaban en el enum.
-- Backup previo: backups/riviera_v1_pre_promo_enum_20261114_162351.dump
-- Solo riviera_v1; no db push / migrate reset.

ALTER TYPE "PromotionConditionType" ADD VALUE IF NOT EXISTS 'NIGHTS';
ALTER TYPE "PromotionConditionType" ADD VALUE IF NOT EXISTS 'STAY_DATE';
ALTER TYPE "PromotionConditionType" ADD VALUE IF NOT EXISTS 'OCCUPANCY_HOTEL';
ALTER TYPE "PromotionConditionType" ADD VALUE IF NOT EXISTS 'DAYS_OF_WEEK';
