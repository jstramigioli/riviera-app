-- PGH-167: beneficio FREE_NIGHTS (noches sin cargo; ej. paga 4 queda 5).
-- Backup previo: backups/riviera_v1_pre_free_nights_20261114_164709.dump
-- Solo riviera_v1; no db push / migrate reset.

ALTER TYPE "PromotionBenefitType" ADD VALUE IF NOT EXISTS 'FREE_NIGHTS';