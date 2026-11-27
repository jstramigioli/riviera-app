-- Identidad documental: país emisor + número normalizado + unicidad;
-- revisión manual; snapshot de fotos en OnlineCheckIn.

-- Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentIssuingCountry" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "documentNumberNormalized" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "needsIdentityReview" BOOLEAN NOT NULL DEFAULT false;

-- Guest
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "documentIssuingCountry" TEXT;

-- OnlineCheckIn snapshot + revisión
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentIssuingCountry" TEXT;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentNumberNormalized" TEXT;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentPhotoFrontStoredName" TEXT;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentPhotoFrontOriginalName" TEXT;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentPhotoFrontMimeType" TEXT;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentPhotoFrontSizeBytes" INTEGER;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentPhotoBackStoredName" TEXT;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentPhotoBackOriginalName" TEXT;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentPhotoBackMimeType" TEXT;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "documentPhotoBackSizeBytes" INTEGER;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "needsManualReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "identityConflictNote" TEXT;

-- Backfill Client: normalizar número y país emisor (default AR / country de residencia)
UPDATE "Client"
SET
  "documentNumberNormalized" = NULLIF(
    UPPER(REGEXP_REPLACE(TRIM("documentNumber"), '[\s.\-/\\_]+', '', 'g')),
    ''
  ),
  "documentIssuingCountry" = COALESCE(
    NULLIF(UPPER(TRIM("documentIssuingCountry")), ''),
    NULLIF(UPPER(TRIM("country")), ''),
    'AR'
  )
WHERE "documentNumber" IS NOT NULL
  AND TRIM("documentNumber") <> '';

-- Duplicados: dejar la clave única en el id más bajo; marcar el resto para revisión
-- y desambiguar el normalizado para no bloquear el índice único.
WITH ranked AS (
  SELECT
    id,
    "documentType",
    "documentIssuingCountry",
    "documentNumberNormalized",
    ROW_NUMBER() OVER (
      PARTITION BY "documentType", "documentIssuingCountry", "documentNumberNormalized"
      ORDER BY id ASC
    ) AS rn
  FROM "Client"
  WHERE "documentNumberNormalized" IS NOT NULL
    AND "documentIssuingCountry" IS NOT NULL
)
UPDATE "Client" AS c
SET
  "needsIdentityReview" = true,
  "documentNumberNormalized" = c."documentNumberNormalized" || '-dup' || c.id::text
FROM ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- Backfill Guest país emisor
UPDATE "Guest" AS g
SET "documentIssuingCountry" = COALESCE(
  NULLIF(UPPER(TRIM(g."documentIssuingCountry")), ''),
  NULLIF(UPPER(TRIM(c."documentIssuingCountry")), ''),
  NULLIF(UPPER(TRIM(c.country)), ''),
  'AR'
)
FROM "Client" AS c
WHERE g."clientId" = c.id
  AND g."documentNumber" IS NOT NULL
  AND TRIM(g."documentNumber") <> ''
  AND (g."documentIssuingCountry" IS NULL OR TRIM(g."documentIssuingCountry") = '');

UPDATE "Guest"
SET "documentIssuingCountry" = 'AR'
WHERE "documentNumber" IS NOT NULL
  AND TRIM("documentNumber") <> ''
  AND ("documentIssuingCountry" IS NULL OR TRIM("documentIssuingCountry") = '');

-- Backfill OnlineCheckIn keys (snapshot)
UPDATE "OnlineCheckIn"
SET
  "documentNumberNormalized" = NULLIF(
    UPPER(REGEXP_REPLACE(TRIM("documentNumber"), '[\s.\-/\\_]+', '', 'g')),
    ''
  ),
  "documentIssuingCountry" = COALESCE(
    NULLIF(UPPER(TRIM("documentIssuingCountry")), ''),
    NULLIF(UPPER(TRIM("country")), ''),
    'AR'
  )
WHERE "documentNumber" IS NOT NULL
  AND TRIM("documentNumber") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "Client_documentType_documentIssuingCountry_documentNumberNormalized_key"
  ON "Client"("documentType", "documentIssuingCountry", "documentNumberNormalized");

CREATE INDEX IF NOT EXISTS "Client_documentNumberNormalized_idx"
  ON "Client"("documentNumberNormalized");

CREATE INDEX IF NOT EXISTS "Client_lastName_firstName_idx"
  ON "Client"("lastName", "firstName");

CREATE INDEX IF NOT EXISTS "OnlineCheckIn_needsManualReview_idx"
  ON "OnlineCheckIn"("needsManualReview");
