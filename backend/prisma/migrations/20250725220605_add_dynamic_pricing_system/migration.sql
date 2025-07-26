-- CreateEnum
CREATE TYPE "MealPricingMode" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateTable
CREATE TABLE "DynamicPricingConfig" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "anticipationThresholds" INTEGER[],
    "anticipationWeight" DOUBLE PRECISION NOT NULL,
    "globalOccupancyWeight" DOUBLE PRECISION NOT NULL,
    "isWeekendWeight" DOUBLE PRECISION NOT NULL,
    "isHolidayWeight" DOUBLE PRECISION NOT NULL,
    "demandIndexWeight" DOUBLE PRECISION NOT NULL,
    "weatherScoreWeight" DOUBLE PRECISION NOT NULL,
    "eventImpactWeight" DOUBLE PRECISION NOT NULL,
    "maxAdjustmentPercentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynamicPricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalKeyframe" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonalKeyframe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRoomRate" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomTypeId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "baseRate" DOUBLE PRECISION NOT NULL,
    "dynamicRate" DOUBLE PRECISION NOT NULL,
    "withBreakfast" DOUBLE PRECISION NOT NULL,
    "withHalfBoard" DOUBLE PRECISION NOT NULL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRoomRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomGapPromotion" (
    "id" TEXT NOT NULL,
    "roomId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "discountRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomGapPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPricingRule" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "breakfastMode" "MealPricingMode" NOT NULL,
    "breakfastValue" DOUBLE PRECISION NOT NULL,
    "dinnerMode" "MealPricingMode" NOT NULL,
    "dinnerValue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DynamicPricingConfig_hotelId_key" ON "DynamicPricingConfig"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRoomRate_hotelId_roomTypeId_date_key" ON "DailyRoomRate"("hotelId", "roomTypeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MealPricingRule_hotelId_key" ON "MealPricingRule"("hotelId");

-- AddForeignKey
ALTER TABLE "DailyRoomRate" ADD CONSTRAINT "DailyRoomRate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomGapPromotion" ADD CONSTRAINT "RoomGapPromotion_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
