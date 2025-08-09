/*
  Warnings:

  - A unique constraint covering the columns `[hotelId,date]` on the table `OpenDay` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "OpenDay_date_key";

-- AlterTable
ALTER TABLE "OpenDay" ADD COLUMN     "hotelId" TEXT;

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- Insert default hotel
INSERT INTO "Hotel" ("id", "name", "description", "isActive", "createdAt", "updatedAt") 
VALUES ('default-hotel', 'Hotel Riviera', 'Hotel por defecto', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Update existing OpenDay records to use default hotel
UPDATE "OpenDay" SET "hotelId" = 'default-hotel' WHERE "hotelId" IS NULL;

-- Update other existing records to use default hotel
UPDATE "DynamicPricingConfig" SET "hotelId" = 'default-hotel' WHERE "hotelId" IS NULL;
UPDATE "SeasonalKeyframe" SET "hotelId" = 'default-hotel' WHERE "hotelId" IS NULL;
UPDATE "DailyRoomRate" SET "hotelId" = 'default-hotel' WHERE "hotelId" IS NULL;
UPDATE "MealPricingRule" SET "hotelId" = 'default-hotel' WHERE "hotelId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OpenDay_hotelId_date_key" ON "OpenDay"("hotelId", "date");

-- AddForeignKey
ALTER TABLE "OpenDay" ADD CONSTRAINT "OpenDay_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DynamicPricingConfig" ADD CONSTRAINT "DynamicPricingConfig_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalKeyframe" ADD CONSTRAINT "SeasonalKeyframe_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRoomRate" ADD CONSTRAINT "DailyRoomRate_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPricingRule" ADD CONSTRAINT "MealPricingRule_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
