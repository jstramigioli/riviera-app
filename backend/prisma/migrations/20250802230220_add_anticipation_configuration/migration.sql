-- AlterTable
ALTER TABLE "public"."DynamicPricingConfig" ADD COLUMN     "anticipationMaxDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "anticipationMode" TEXT NOT NULL DEFAULT 'ESCALONADO',
ADD COLUMN     "anticipationSteps" JSONB;
