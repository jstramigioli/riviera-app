/*
  Warnings:

  - You are about to drop the column `withBreakfast` on the `DailyRoomRate` table. All the data in the column will be lost.
  - You are about to drop the column `withHalfBoard` on the `DailyRoomRate` table. All the data in the column will be lost.
  - You are about to drop the column `isOperational` on the `SeasonalKeyframe` table. All the data in the column will be lost.
  - You are about to drop the column `operationalType` on the `SeasonalKeyframe` table. All the data in the column will be lost.
  - You are about to drop the column `periodId` on the `SeasonalKeyframe` table. All the data in the column will be lost.
  - You are about to drop the `DailyRate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MealPricingRule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OperationalPeriod` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RateType` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServiceAdjustment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."DailyRate" DROP CONSTRAINT "DailyRate_roomTypeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MealPricingRule" DROP CONSTRAINT "MealPricingRule_hotelId_fkey";

-- DropForeignKey
ALTER TABLE "public"."OperationalPeriod" DROP CONSTRAINT "OperationalPeriod_hotelId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RateType" DROP CONSTRAINT "RateType_hotelId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceAdjustment" DROP CONSTRAINT "ServiceAdjustment_roomTypeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServiceAdjustment" DROP CONSTRAINT "ServiceAdjustment_serviceTypeId_fkey";

-- AlterTable
ALTER TABLE "public"."DailyRoomRate" DROP COLUMN "withBreakfast",
DROP COLUMN "withHalfBoard";

-- AlterTable
ALTER TABLE "public"."SeasonalKeyframe" DROP COLUMN "isOperational",
DROP COLUMN "operationalType",
DROP COLUMN "periodId";

-- DropTable
DROP TABLE "public"."DailyRate";

-- DropTable
DROP TABLE "public"."MealPricingRule";

-- DropTable
DROP TABLE "public"."OperationalPeriod";

-- DropTable
DROP TABLE "public"."RateType";

-- DropTable
DROP TABLE "public"."ServiceAdjustment";

-- DropEnum
DROP TYPE "public"."MealPricingMode";

-- CreateTable
CREATE TABLE "public"."SeasonServiceAdjustment" (
    "id" TEXT NOT NULL,
    "seasonBlockId" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "roomTypeId" INTEGER NOT NULL,
    "mode" "public"."ServiceAdjustmentMode" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonServiceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonServiceAdjustment_seasonBlockId_serviceTypeId_roomTyp_key" ON "public"."SeasonServiceAdjustment"("seasonBlockId", "serviceTypeId", "roomTypeId");

-- AddForeignKey
ALTER TABLE "public"."SeasonServiceAdjustment" ADD CONSTRAINT "SeasonServiceAdjustment_seasonBlockId_fkey" FOREIGN KEY ("seasonBlockId") REFERENCES "public"."SeasonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonServiceAdjustment" ADD CONSTRAINT "SeasonServiceAdjustment_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "public"."ServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonServiceAdjustment" ADD CONSTRAINT "SeasonServiceAdjustment_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "public"."RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
