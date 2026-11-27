-- Dietas por huesped / snapshot check-in (dejan de vivir en Reservation).

ALTER TABLE "Guest" ADD COLUMN "dietVegetariano" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN "dietVegano" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Guest" ADD COLUMN "dietCeliaco" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OnlineCheckIn" ADD COLUMN "dietVegetariano" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnlineCheckIn" ADD COLUMN "dietVegano" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnlineCheckIn" ADD COLUMN "dietCeliaco" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Guest" AS g
SET
  "dietVegetariano" = COALESCE(r."dietVegetariano", false) OR g."dietVegetariano",
  "dietVegano" = COALESCE(r."dietVegano", false) OR g."dietVegano",
  "dietCeliaco" = COALESCE(r."dietCeliaco", false) OR g."dietCeliaco"
FROM "Reservation" AS r
WHERE g."reservationId" = r.id
  AND (
    COALESCE(r."dietVegetariano", false)
    OR COALESCE(r."dietVegano", false)
    OR COALESCE(r."dietCeliaco", false)
  );

UPDATE "OnlineCheckIn" AS o
SET
  "dietVegetariano" = g."dietVegetariano",
  "dietVegano" = g."dietVegano",
  "dietCeliaco" = g."dietCeliaco"
FROM "Guest" AS g
WHERE o."guestId" = g.id
  AND (
    g."dietVegetariano"
    OR g."dietVegano"
    OR g."dietCeliaco"
  );

ALTER TABLE "Reservation" DROP COLUMN "dietVegetariano";
ALTER TABLE "Reservation" DROP COLUMN "dietVegano";
ALTER TABLE "Reservation" DROP COLUMN "dietCeliaco";