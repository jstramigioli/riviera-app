-- AlterTable
ALTER TABLE "public"."DynamicPricingConfig" ADD COLUMN     "anticipationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "holidayEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "occupancyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weekendEnabled" BOOLEAN NOT NULL DEFAULT true;
