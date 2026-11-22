-- Requisitos por tramo: estacionamiento en Query y ReservationSegment
ALTER TABLE "Query" ADD COLUMN IF NOT EXISTS "requiereEstacionamiento" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "requiereEstacionamiento" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: reservas con estacionamiento a nivel general → segmentos
UPDATE "ReservationSegment" AS rs
SET "requiereEstacionamiento" = true
FROM "Reservation" AS r
WHERE rs."reservationId" = r.id
  AND r."requiereEstacionamiento" = true
  AND rs."requiereEstacionamiento" = false;