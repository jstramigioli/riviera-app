-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "notaComidas" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "dietVegetariano" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reservation" ADD COLUMN "dietVegano" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reservation" ADD COLUMN "dietCeliaco" BOOLEAN NOT NULL DEFAULT false;
