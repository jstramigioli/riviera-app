-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "requiereCuna" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reservation" ADD COLUMN "requiereEstacionamiento" BOOLEAN NOT NULL DEFAULT false;
