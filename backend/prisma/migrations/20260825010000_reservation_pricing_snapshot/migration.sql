-- Snapshot de tarifas en reserva + override/descuento
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "discountType" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "discountValue" DOUBLE PRECISION;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "discountReason" TEXT;

ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "listRate" DOUBLE PRECISION;
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "isManualRate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "pricingNotes" TEXT;
ALTER TABLE "ReservationSegment" ADD COLUMN IF NOT EXISTS "nightRates" JSONB;

ALTER TABLE "ReservationNightRate" ADD COLUMN IF NOT EXISTS "listRate" DOUBLE PRECISION;
ALTER TABLE "ReservationNightRate" ADD COLUMN IF NOT EXISTS "seasonBlockId" TEXT;
