-- AlterTable
ALTER TABLE "public"."DynamicPricingConfig" ADD COLUMN     "weekendDays" INTEGER[] DEFAULT ARRAY[0, 6]::INTEGER[];
