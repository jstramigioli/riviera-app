-- Quitar override manual de tarifas en folio (Cargo).
-- Descuentos/promos y cargos no-alojamiento no se tocan.
-- ReservationNightRate.manualOverride se conserva (legacy / sync siempre false).

ALTER TABLE "Cargo" DROP COLUMN IF EXISTS "montoOriginal";
ALTER TABLE "Cargo" DROP COLUMN IF EXISTS "manualOverride";
