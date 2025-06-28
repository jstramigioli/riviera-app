/*
  Warnings:

  - You are about to drop the column `requiredRoomTypeId` on the `Reservation` table. All the data in the column will be lost.
*/

-- AlterTable
-- Primero agregamos la columna con un valor por defecto
ALTER TABLE "Reservation" ADD COLUMN "requiredGuests" INTEGER DEFAULT 1;

-- Actualizamos los valores basados en la capacidad de la habitación asignada
UPDATE "Reservation" 
SET "requiredGuests" = (
  SELECT "maxPeople" 
  FROM "Room" 
  WHERE "Room"."id" = "Reservation"."roomId"
);

-- Hacemos la columna NOT NULL después de actualizar los datos
ALTER TABLE "Reservation" ALTER COLUMN "requiredGuests" SET NOT NULL;
ALTER TABLE "Reservation" ALTER COLUMN "requiredGuests" DROP DEFAULT;

-- Eliminamos la columna antigua
ALTER TABLE "Reservation" DROP COLUMN "requiredRoomTypeId";
