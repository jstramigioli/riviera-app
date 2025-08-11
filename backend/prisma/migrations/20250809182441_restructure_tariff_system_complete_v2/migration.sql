/*
  Warnings:

  - You are about to drop the `SeasonServiceAdjustment` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[seasonBlockId,roomTypeId,serviceTypeId]` on the table `SeasonPrice` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `serviceTypeId` to the `SeasonPrice` table without a default value. This is not possible if the table is not empty.

*/

-- Paso 1: Crear las nuevas tablas primero
CREATE TABLE "public"."RoundingConfig" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "multiple" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'nearest',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoundingConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ProportionCoefficient" (
    "id" TEXT NOT NULL,
    "seasonBlockId" TEXT NOT NULL,
    "roomTypeId" INTEGER NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProportionCoefficient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ServiceAdjustment" (
    "id" TEXT NOT NULL,
    "seasonBlockId" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "mode" "public"."ServiceAdjustmentMode" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAdjustment_pkey" PRIMARY KEY ("id")
);

-- Paso 2: Agregar columna serviceTypeId como nullable primero
ALTER TABLE "public"."SeasonPrice" ADD COLUMN "serviceTypeId" TEXT;

-- Paso 3: Asignar el tipo de servicio "Solo Alojamiento" a todos los precios existentes
UPDATE "public"."SeasonPrice" 
SET "serviceTypeId" = (
    SELECT id FROM "public"."ServiceType" 
    WHERE name = 'Solo Alojamiento' AND "hotelId" = 'default-hotel' 
    LIMIT 1
);

-- Paso 4: Hacer la columna NOT NULL ahora que tiene valores
ALTER TABLE "public"."SeasonPrice" ALTER COLUMN "serviceTypeId" SET NOT NULL;

-- Paso 5: Actualizar SeasonBlock con nuevas columnas
ALTER TABLE "public"."SeasonBlock" ADD COLUMN "referenceRoomTypeId" INTEGER,
ADD COLUMN "serviceAdjustmentMode" TEXT NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN "useProportions" BOOLEAN NOT NULL DEFAULT false;

-- Paso 6: Migrar datos de SeasonServiceAdjustment a ServiceAdjustment
-- Agrupar ajustes por seasonBlockId y serviceTypeId (promediando valores si hay múltiples)
INSERT INTO "public"."ServiceAdjustment" ("id", "seasonBlockId", "serviceTypeId", "mode", "value", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid() as id,
    "seasonBlockId",
    "serviceTypeId",
    "mode",
    AVG("value") as value,
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "public"."SeasonServiceAdjustment"
GROUP BY "seasonBlockId", "serviceTypeId", "mode";

-- Paso 7: Crear coeficientes de proporción por defecto para todos los tipos de habitación
INSERT INTO "public"."ProportionCoefficient" ("id", "seasonBlockId", "roomTypeId", "coefficient", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid() as id,
    sb.id as "seasonBlockId",
    rt.id as "roomTypeId",
    rt.multiplier as coefficient,
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "public"."SeasonBlock" sb
CROSS JOIN "public"."RoomType" rt;

-- Paso 8: Crear configuración de redondeo por defecto para el hotel
INSERT INTO "public"."RoundingConfig" ("id", "hotelId", "multiple", "mode", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid() as id,
    'default-hotel' as "hotelId",
    1 as multiple,
    'nearest' as mode,
    NOW() as "createdAt",
    NOW() as "updatedAt"
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."RoundingConfig" WHERE "hotelId" = 'default-hotel'
);

-- Paso 9: Eliminar constraints y tabla antigua
-- DropForeignKey
ALTER TABLE "public"."SeasonServiceAdjustment" DROP CONSTRAINT "SeasonServiceAdjustment_roomTypeId_fkey";
ALTER TABLE "public"."SeasonServiceAdjustment" DROP CONSTRAINT "SeasonServiceAdjustment_seasonBlockId_fkey";
ALTER TABLE "public"."SeasonServiceAdjustment" DROP CONSTRAINT "SeasonServiceAdjustment_serviceTypeId_fkey";

-- DropIndex
DROP INDEX "public"."SeasonPrice_seasonBlockId_roomTypeId_key";

-- DropTable
DROP TABLE "public"."SeasonServiceAdjustment";

-- Paso 10: Crear índices únicos
CREATE UNIQUE INDEX "RoundingConfig_hotelId_key" ON "public"."RoundingConfig"("hotelId");
CREATE UNIQUE INDEX "ProportionCoefficient_seasonBlockId_roomTypeId_key" ON "public"."ProportionCoefficient"("seasonBlockId", "roomTypeId");
CREATE UNIQUE INDEX "ServiceAdjustment_seasonBlockId_serviceTypeId_key" ON "public"."ServiceAdjustment"("seasonBlockId", "serviceTypeId");
CREATE UNIQUE INDEX "SeasonPrice_seasonBlockId_roomTypeId_serviceTypeId_key" ON "public"."SeasonPrice"("seasonBlockId", "roomTypeId", "serviceTypeId");

-- Paso 11: Agregar Foreign Keys
ALTER TABLE "public"."RoundingConfig" ADD CONSTRAINT "RoundingConfig_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."SeasonPrice" ADD CONSTRAINT "SeasonPrice_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProportionCoefficient" ADD CONSTRAINT "ProportionCoefficient_seasonBlockId_fkey" FOREIGN KEY ("seasonBlockId") REFERENCES "public"."SeasonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ProportionCoefficient" ADD CONSTRAINT "ProportionCoefficient_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "public"."RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ServiceAdjustment" ADD CONSTRAINT "ServiceAdjustment_seasonBlockId_fkey" FOREIGN KEY ("seasonBlockId") REFERENCES "public"."SeasonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ServiceAdjustment" ADD CONSTRAINT "ServiceAdjustment_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."ServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
