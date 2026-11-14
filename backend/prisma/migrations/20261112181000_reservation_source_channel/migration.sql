-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('WHATSAPP', 'MAIL', 'WEBSITE', 'BOOKING');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "source" "ReservationSource";

-- AlterTable
ALTER TABLE "QueryGroup" ADD COLUMN "source" "ReservationSource";

-- CreateIndex
CREATE INDEX "Reservation_source_idx" ON "Reservation"("source");

-- CreateIndex
CREATE INDEX "QueryGroup_source_idx" ON "QueryGroup"("source");
