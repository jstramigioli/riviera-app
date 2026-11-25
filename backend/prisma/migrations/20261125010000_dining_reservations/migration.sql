-- CreateEnum
CREATE TYPE "DiningServiceType" AS ENUM ('CENA');

-- CreateEnum
CREATE TYPE "DiningReservationStatus" AS ENUM ('CONFIRMADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "DiningReservation" (
    "id" SERIAL NOT NULL,
    "serviceDate" DATE NOT NULL,
    "serviceType" "DiningServiceType" NOT NULL DEFAULT 'CENA',
    "clientId" INTEGER NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "reservationId" INTEGER,
    "accountId" INTEGER,
    "status" "DiningReservationStatus" NOT NULL DEFAULT 'CONFIRMADA',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiningReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiningReservation_serviceDate_serviceType_status_idx" ON "DiningReservation"("serviceDate", "serviceType", "status");

-- CreateIndex
CREATE INDEX "DiningReservation_clientId_idx" ON "DiningReservation"("clientId");

-- CreateIndex
CREATE INDEX "DiningReservation_reservationId_idx" ON "DiningReservation"("reservationId");

-- CreateIndex
CREATE INDEX "DiningReservation_accountId_idx" ON "DiningReservation"("accountId");

-- CreateIndex
CREATE INDEX "DiningReservation_createdAt_idx" ON "DiningReservation"("createdAt");

-- CreateIndex
CREATE INDEX "DiningReservation_updatedAt_idx" ON "DiningReservation"("updatedAt");

-- AddForeignKey
ALTER TABLE "DiningReservation" ADD CONSTRAINT "DiningReservation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningReservation" ADD CONSTRAINT "DiningReservation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningReservation" ADD CONSTRAINT "DiningReservation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
