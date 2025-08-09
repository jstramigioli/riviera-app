/*
  Warnings:

  - Made the column `hotelId` on table `OpenDay` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "OpenDay" DROP CONSTRAINT "OpenDay_hotelId_fkey";

-- AlterTable
ALTER TABLE "OpenDay" ALTER COLUMN "hotelId" SET NOT NULL;

-- CreateTable
CREATE TABLE "OperationalPeriod" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalPeriod_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OpenDay" ADD CONSTRAINT "OpenDay_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalPeriod" ADD CONSTRAINT "OperationalPeriod_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
