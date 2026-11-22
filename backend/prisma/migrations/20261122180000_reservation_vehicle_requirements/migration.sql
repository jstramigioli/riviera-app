-- Requisitos vehículo / tráiler por tramo (Query, ReservationSegment) + mirror Reservation

DO $$ BEGIN
  CREATE TYPE "VehicleType" AS ENUM ('AUTO', 'CAMIONETA', 'MOTO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Query" ADD COLUMN IF NOT EXISTS "vehicleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Query" ADD COLUMN IF NOT EXISTS "vehicleType" "VehicleType";
ALTER TABLE "Query" ADD COLUMN IF NOT EXISTS "trailerCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "vehicleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "vehicleType" "VehicleType";
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "trailerCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "vehicleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "vehicleType" "VehicleType";
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "trailerCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: estacionamiento legacy → 1 auto
UPDATE "Query"
SET "vehicleCount" = 1, "vehicleType" = 'AUTO'
WHERE "requiereEstacionamiento" = true AND "vehicleCount" = 0;

UPDATE "ReservationSegment"
SET "vehicleCount" = 1, "vehicleType" = 'AUTO'
WHERE "requiereEstacionamiento" = true AND "vehicleCount" = 0;

UPDATE "Reservation"
SET "vehicleCount" = 1, "vehicleType" = 'AUTO'
WHERE "requiereEstacionamiento" = true AND "vehicleCount" = 0;
