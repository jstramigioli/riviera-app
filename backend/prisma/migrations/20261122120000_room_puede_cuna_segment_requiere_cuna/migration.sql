-- Room: puede contener cuna (config habitaciones)
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "puedeCuna" BOOLEAN NOT NULL DEFAULT false;

-- Requisitos por tramo: cuna en Query y ReservationSegment
ALTER TABLE "Query" ADD COLUMN IF NOT EXISTS "requiereCuna" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "requiereCuna" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: reservas con cuna a nivel general → todos sus segmentos activos
UPDATE "ReservationSegment" AS rs
SET "requiereCuna" = true
FROM "Reservation" AS r
WHERE rs."reservationId" = r.id
  AND r."requiereCuna" = true
  AND rs."requiereCuna" = false;
