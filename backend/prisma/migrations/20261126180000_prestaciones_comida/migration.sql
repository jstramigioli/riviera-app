-- Régimen de comidas por tipo de servicio (interno) + prestaciones de comida previstas.
-- Las prestaciones de origen REGIMEN se generan con `npm run sync:comidas` y
-- se mantienen sincronizadas al crear/modificar reservas.

DO $$ BEGIN
  CREATE TYPE "TipoComida" AS ENUM ('DESAYUNO', 'CENA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrigenPrestacion" AS ENUM ('REGIMEN', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoPrestacion" AS ENUM ('PREVISTA', 'CANCELADA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ServiceType" ADD COLUMN IF NOT EXISTS "incluyeDesayuno" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ServiceType" ADD COLUMN IF NOT EXISTS "incluyeCena" BOOLEAN NOT NULL DEFAULT false;

-- Backfill por nombre/descripcion (mismas reglas que usaba el frontend):
-- media pensión → desayuno + cena; solo alojamiento / sin desayuno → nada; desayuno → desayuno.
-- Solo toca servicios que todavía no tienen régimen asignado.
WITH norm AS (
  SELECT
    "id",
    regexp_replace(
      translate(lower("name" || ' ' || coalesce("description", '')), 'áéíóúü', 'aeiouu'),
      '[^a-z0-9]+', '_', 'g'
    ) AS blob
  FROM "ServiceType"
  WHERE "incluyeDesayuno" = false AND "incluyeCena" = false
)
UPDATE "ServiceType" st
SET
  "incluyeDesayuno" = CASE
    WHEN n.blob LIKE '%media_pension%' OR n.blob LIKE '%half%' THEN true
    WHEN n.blob LIKE '%solo_alojamiento%' OR n.blob LIKE '%sin_desayuno%' THEN false
    WHEN n.blob LIKE '%desayuno%' OR n.blob LIKE '%breakfast%' THEN true
    ELSE false
  END,
  "incluyeCena" = (n.blob LIKE '%media_pension%' OR n.blob LIKE '%half%')
FROM norm n
WHERE st."id" = n."id";

CREATE TABLE IF NOT EXISTS "PrestacionComida" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoComida" NOT NULL,
    "origen" "OrigenPrestacion" NOT NULL DEFAULT 'REGIMEN',
    "incluida" BOOLEAN NOT NULL DEFAULT true,
    "reservationId" INTEGER,
    "pax" INTEGER NOT NULL,
    "paxManual" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoPrestacion" NOT NULL DEFAULT 'PREVISTA',
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "canceladaAt" TIMESTAMP(3),
    "motivoCancelacion" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrestacionComida_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrestacionComida_fecha_tipo_idx" ON "PrestacionComida"("fecha", "tipo");
CREATE UNIQUE INDEX IF NOT EXISTS "PrestacionComida_reservationId_fecha_tipo_origen_key" ON "PrestacionComida"("reservationId", "fecha", "tipo", "origen");

DO $$ BEGIN
  ALTER TABLE "PrestacionComida" ADD CONSTRAINT "PrestacionComida_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
