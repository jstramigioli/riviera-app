-- Account (folio financiero): RESERVATION 1:1 + EXTERNAL
-- Backup previo documentado: riviera_v1_pre_account_*.dump

CREATE TYPE "AccountKind" AS ENUM ('RESERVATION', 'EXTERNAL');
CREATE TYPE "AccountStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "reservationId" INTEGER,
    "clientId" INTEGER,
    "label" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Account_reservationId_key" ON "Account"("reservationId");
CREATE INDEX "Account_kind_status_idx" ON "Account"("kind", "status");
CREATE INDEX "Account_clientId_idx" ON "Account"("clientId");
CREATE INDEX "Account_createdAt_idx" ON "Account"("createdAt");

ALTER TABLE "Account"
  ADD CONSTRAINT "Account_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Account"
  ADD CONSTRAINT "Account_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- FK financieras nullable + dual-write
ALTER TABLE "Cargo" ADD COLUMN "accountId" INTEGER;
ALTER TABLE "Pago" ADD COLUMN "accountId" INTEGER;

-- reservaId pasa a nullable (cuentas EXTERNAL)
ALTER TABLE "Cargo" ALTER COLUMN "reservaId" DROP NOT NULL;
ALTER TABLE "Pago" ALTER COLUMN "reservaId" DROP NOT NULL;

-- Backfill: 1 Account RESERVATION por cada Reservation
INSERT INTO "Account" ("kind", "reservationId", "clientId", "status", "label", "createdAt", "updatedAt")
SELECT
  'RESERVATION'::"AccountKind",
  r."id",
  r."mainClientId",
  'OPEN'::"AccountStatus",
  'Reserva #' || r."id",
  COALESCE(r."createdAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "Reservation" r
WHERE NOT EXISTS (
  SELECT 1 FROM "Account" a WHERE a."reservationId" = r."id"
);

UPDATE "Cargo" c
SET "accountId" = a."id"
FROM "Account" a
WHERE a."reservationId" = c."reservaId"
  AND c."accountId" IS NULL;

UPDATE "Pago" p
SET "accountId" = a."id"
FROM "Account" a
WHERE a."reservationId" = p."reservaId"
  AND p."accountId" IS NULL;

-- Asserts (fallan la migrate si hay huérfanos)
DO $$
DECLARE
  orphan_cargos INT;
  orphan_pagos INT;
  missing_accounts INT;
BEGIN
  SELECT COUNT(*) INTO orphan_cargos FROM "Cargo" WHERE "accountId" IS NULL;
  SELECT COUNT(*) INTO orphan_pagos FROM "Pago" WHERE "accountId" IS NULL;
  SELECT COUNT(*) INTO missing_accounts
  FROM "Reservation" r
  WHERE NOT EXISTS (SELECT 1 FROM "Account" a WHERE a."reservationId" = r."id");

  IF orphan_cargos > 0 OR orphan_pagos > 0 OR missing_accounts > 0 THEN
    RAISE EXCEPTION
      'Account backfill incompleto: orphan_cargos=%, orphan_pagos=%, missing_accounts=%',
      orphan_cargos, orphan_pagos, missing_accounts;
  END IF;
END $$;

ALTER TABLE "Cargo" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "Pago" ALTER COLUMN "accountId" SET NOT NULL;

CREATE INDEX "Cargo_accountId_idx" ON "Cargo"("accountId");
CREATE INDEX "Pago_accountId_idx" ON "Pago"("accountId");
CREATE INDEX IF NOT EXISTS "Cargo_reservaId_idx" ON "Cargo"("reservaId");
CREATE INDEX IF NOT EXISTS "Pago_reservaId_idx" ON "Pago"("reservaId");

ALTER TABLE "Cargo"
  ADD CONSTRAINT "Cargo_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pago"
  ADD CONSTRAINT "Pago_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
