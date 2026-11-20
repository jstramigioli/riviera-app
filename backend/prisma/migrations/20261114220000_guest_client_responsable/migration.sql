-- PGH-188: Guest.clientId + backfill titular como huésped
-- Backup: riviera_v1_pre_responsable_huespedes_*.dump
-- Criterio: responsable (mainClientId) ≠ lista Guest[]; por historico el titular
-- se alojaba → se materializa como Guest con clientId = mainClientId.

ALTER TABLE "Guest" ADD COLUMN "clientId" INTEGER;

CREATE INDEX "Guest_clientId_idx" ON "Guest"("clientId");
CREATE INDEX "Guest_reservationId_clientId_idx" ON "Guest"("reservationId", "clientId");

ALTER TABLE "Guest"
  ADD CONSTRAINT "Guest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: 1 Guest del titular por reserva si aún no existe vínculo ni match por documento
INSERT INTO "Guest" (
  "firstName",
  "lastName",
  "documentType",
  "documentNumber",
  "phone",
  "email",
  "address",
  "city",
  "reservationId",
  "clientId",
  "createdAt",
  "updatedAt"
)
SELECT
  c."firstName",
  c."lastName",
  COALESCE(NULLIF(c."documentType", ''), 'DNI'),
  c."documentNumber",
  c."phone",
  c."email",
  NULL,
  c."city",
  r."id",
  c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Reservation" r
INNER JOIN "Client" c ON c."id" = r."mainClientId"
WHERE NOT EXISTS (
  SELECT 1 FROM "Guest" g
  WHERE g."reservationId" = r."id"
    AND g."clientId" = r."mainClientId"
)
AND NOT EXISTS (
  SELECT 1 FROM "Guest" g
  WHERE g."reservationId" = r."id"
    AND c."documentNumber" IS NOT NULL
    AND NULLIF(TRIM(c."documentNumber"), '') IS NOT NULL
    AND LOWER(TRIM(g."documentNumber")) = LOWER(TRIM(c."documentNumber"))
);

-- Vincular huéspedes ya existentes que coinciden por documento con el titular
UPDATE "Guest" g
SET "clientId" = r."mainClientId"
FROM "Reservation" r
INNER JOIN "Client" c ON c."id" = r."mainClientId"
WHERE g."reservationId" = r."id"
  AND g."clientId" IS NULL
  AND c."documentNumber" IS NOT NULL
  AND NULLIF(TRIM(c."documentNumber"), '') IS NOT NULL
  AND g."documentNumber" IS NOT NULL
  AND LOWER(TRIM(g."documentNumber")) = LOWER(TRIM(c."documentNumber"));
