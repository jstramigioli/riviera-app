/*
  Warnings:

  - Added the required column `roomTypeId` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- 1. Hacer roomTypeId nullable para poder poblar datos
ALTER TABLE "Room" ADD COLUMN     "roomTypeId" INTEGER;

-- CreateTable
CREATE TABLE "RoomType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRate" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "roomTypeId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "minStay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRate_pkey" PRIMARY KEY ("id")
);

-- 3. Poblar RoomType
INSERT INTO "RoomType" ("name") VALUES
  ('single'),
  ('doble'),
  ('triple'),
  ('cuadruple'),
  ('departamento El Romerito'),
  ('departamento El Tilo'),
  ('departamento Via 1'),
  ('departamento La Esquinita');

-- 4. Asignar roomTypeId a habitaciones numeradas
UPDATE "Room" SET "roomTypeId" = (SELECT id FROM "RoomType" WHERE name = 'triple') WHERE name IN ('1','3','11','12','13','14','15','17','22','28','33','35');
UPDATE "Room" SET "roomTypeId" = (SELECT id FROM "RoomType" WHERE name = 'doble') WHERE name IN ('2','7','8','9','10','16','19','21','23','24','25','26','27','29','30','34','36');
UPDATE "Room" SET "roomTypeId" = (SELECT id FROM "RoomType" WHERE name = 'cuadruple') WHERE name IN ('5','6','18');
UPDATE "Room" SET "roomTypeId" = (SELECT id FROM "RoomType" WHERE name = 'single') WHERE name IN ('31','32');

-- 5. Asignar roomTypeId a departamentos
UPDATE "Room" SET "roomTypeId" = (SELECT id FROM "RoomType" WHERE name = 'departamento El Romerito') WHERE name = 'El Romerito';
UPDATE "Room" SET "roomTypeId" = (SELECT id FROM "RoomType" WHERE name = 'departamento El Tilo') WHERE name = 'El Tilo';
UPDATE "Room" SET "roomTypeId" = (SELECT id FROM "RoomType" WHERE name = 'departamento Via 1') WHERE name = 'Via 1';
UPDATE "Room" SET "roomTypeId" = (SELECT id FROM "RoomType" WHERE name = 'departamento La Esquinita') WHERE name = 'La Esquinita';

-- 6. Volver roomTypeId NOT NULL
ALTER TABLE "Room" ALTER COLUMN "roomTypeId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_name_key" ON "RoomType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRate_date_roomTypeId_key" ON "DailyRate"("date", "roomTypeId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRate" ADD CONSTRAINT "DailyRate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
