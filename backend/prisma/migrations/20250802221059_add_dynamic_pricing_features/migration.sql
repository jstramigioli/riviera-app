-- AlterTable
ALTER TABLE "public"."DynamicPricingConfig" ADD COLUMN     "enableGapPromos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableRecentDemand" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableWeatherApi" BOOLEAN NOT NULL DEFAULT false;
