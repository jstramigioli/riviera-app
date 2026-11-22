-- Check-in online por huésped: token de acceso en Reservation + filas históricas por Guest.

-- AlterTable Reservation: link público único por reserva
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "checkInToken" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "checkInTokenSentAt" TIMESTAMP(3);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "checkInTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Reservation_checkInToken_key" ON "Reservation"("checkInToken");

-- AlterTable OnlineCheckIn: vínculo a Guest/Client + validación staff
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "guestId" INTEGER;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "clientId" INTEGER;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);

-- Token pasa a opcional (acceso nuevo vive en Reservation.checkInToken)
ALTER TABLE "OnlineCheckIn" ALTER COLUMN "token" DROP NOT NULL;

-- Backfill: copiar el token más reciente de OnlineCheckIn a la reserva
UPDATE "Reservation" AS r
SET
  "checkInToken" = sub.token,
  "checkInTokenSentAt" = sub."sentAt",
  "checkInTokenExpiresAt" = sub."expiresAt"
FROM (
  SELECT DISTINCT ON ("reservationId")
    "reservationId",
    token,
    "sentAt",
    "expiresAt"
  FROM "OnlineCheckIn"
  WHERE token IS NOT NULL
  ORDER BY "reservationId", "createdAt" DESC
) AS sub
WHERE r.id = sub."reservationId"
  AND r."checkInToken" IS NULL;

-- Backfill: asociar el check-in más reciente al Guest del titular si existe
UPDATE "OnlineCheckIn" AS oci
SET
  "guestId" = g.id,
  "clientId" = COALESCE(oci."clientId", g."clientId", r."mainClientId")
FROM "Reservation" AS r
INNER JOIN "Guest" AS g
  ON g."reservationId" = r.id
 AND g."clientId" = r."mainClientId"
WHERE oci."reservationId" = r.id
  AND oci."guestId" IS NULL
  AND oci.id = (
    SELECT o2.id
    FROM "OnlineCheckIn" AS o2
    WHERE o2."reservationId" = r.id
    ORDER BY o2."createdAt" DESC
    LIMIT 1
  );

-- Unique por huésped+reserva (Postgres permite múltiples NULL en guestId)
CREATE UNIQUE INDEX IF NOT EXISTS "OnlineCheckIn_reservationId_guestId_key"
  ON "OnlineCheckIn"("reservationId", "guestId");

CREATE INDEX IF NOT EXISTS "OnlineCheckIn_guestId_idx" ON "OnlineCheckIn"("guestId");
CREATE INDEX IF NOT EXISTS "OnlineCheckIn_clientId_idx" ON "OnlineCheckIn"("clientId");

DO $$ BEGIN
  ALTER TABLE "OnlineCheckIn"
    ADD CONSTRAINT "OnlineCheckIn_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "OnlineCheckIn"
    ADD CONSTRAINT "OnlineCheckIn_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
