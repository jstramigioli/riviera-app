-- AlterTable
ALTER TABLE "public"."DynamicPricingConfig" ADD COLUMN     "anticipationAdjustmentPercentage" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
ADD COLUMN     "holidayAdjustmentPercentage" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
ADD COLUMN     "idealOccupancy" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
ADD COLUMN     "maxDiscountPercentage" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
ADD COLUMN     "maxIncreasePercentage" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
ADD COLUMN     "occupancyAdjustmentPercentage" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
ADD COLUMN     "standardRate" DOUBLE PRECISION,
ADD COLUMN     "weekendAdjustmentPercentage" DOUBLE PRECISION NOT NULL DEFAULT 10.0;
