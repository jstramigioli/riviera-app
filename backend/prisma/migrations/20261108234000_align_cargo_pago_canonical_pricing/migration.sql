-- Alinear DB con schema canónico de cargos/pagos/night rates (sin db push)

-- Cargo: nuevos campos del modelo híbrido
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "roomTypeId" INTEGER;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "serviceTypeId" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "subcategoriaCargoId" INTEGER;

-- Subcategorías personalizables (sin ALOJAMIENTO)
CREATE TABLE IF NOT EXISTS "SubcategoriaCargo" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT NOT NULL DEFAULT '#9e9e9e',
    "esActivo" BOOLEAN NOT NULL DEFAULT true,
    "ordenIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubcategoriaCargo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubcategoriaCargo_tipo_codigo_key"
  ON "SubcategoriaCargo"("tipo", "codigo");

-- Configuración (tipo de cambio, etc.)
CREATE TABLE IF NOT EXISTS "Configuracion" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Configuracion_clave_key" ON "Configuracion"("clave");

-- Pago multi-moneda
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "empresa" TEXT;
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "moneda" TEXT;
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "montoARS" DECIMAL(10,2);
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "numeroTarjeta" TEXT;
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "tipoCambio" DECIMAL(10,4);

UPDATE "Pago" SET "moneda" = 'ARS' WHERE "moneda" IS NULL;
UPDATE "Pago" SET "montoARS" = "monto" WHERE "montoARS" IS NULL;

ALTER TABLE "Pago" ALTER COLUMN "moneda" SET DEFAULT 'ARS';
ALTER TABLE "Pago" ALTER COLUMN "moneda" SET NOT NULL;
ALTER TABLE "Pago" ALTER COLUMN "montoARS" SET NOT NULL;

-- Night rates / query: quitar basePrice legacy (usar baseRate)
ALTER TABLE "ReservationNightRate" DROP COLUMN IF EXISTS "basePrice";
ALTER TABLE "QueryNightRate" DROP COLUMN IF EXISTS "basePrice";

-- SeasonBlock legacy basePrice (precios viven en SeasonPrice)
ALTER TABLE "SeasonBlock" DROP COLUMN IF EXISTS "basePrice";

-- Quitar tipo legacy de Cargo (ahora roomTypeId+serviceTypeId o subcategoria)
ALTER TABLE "Cargo" DROP COLUMN IF EXISTS "tipo";

-- FKs Cargo (idempotente)
DO $$ BEGIN
  ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_subcategoriaCargoId_fkey"
    FOREIGN KEY ("subcategoriaCargoId") REFERENCES "SubcategoriaCargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_roomTypeId_fkey"
    FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_serviceTypeId_fkey"
    FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed mínimo de subcategorías no-alojamiento
INSERT INTO "SubcategoriaCargo" ("tipo", "codigo", "nombre", "color", "ordenIndex", "updatedAt")
VALUES
  ('SERVICIO', 'SPA', 'Spa', '#42a5f5', 1, CURRENT_TIMESTAMP),
  ('SERVICIO', 'LAVANDERIA', 'Lavandería', '#42a5f5', 2, CURRENT_TIMESTAMP),
  ('CONSUMO', 'BEBIDAS', 'Bebidas', '#ff7043', 1, CURRENT_TIMESTAMP),
  ('CONSUMO', 'SNACKS', 'Snacks', '#ff7043', 2, CURRENT_TIMESTAMP),
  ('OTRO', 'VARIOS', 'Varios', '#9e9e9e', 1, CURRENT_TIMESTAMP)
ON CONFLICT ("tipo", "codigo") DO NOTHING;

INSERT INTO "Configuracion" ("id", "clave", "valor", "descripcion", "updatedAt")
VALUES ('cfg-tipo-cambio-usd', 'tipo_cambio_usd', '1000', 'Tipo de cambio USD→ARS', CURRENT_TIMESTAMP)
ON CONFLICT ("clave") DO NOTHING;
