/*
  Warnings:

  - You are about to drop the column `maxDiscountPercentage` on the `DynamicPricingConfig` table. All the data in the column will be lost.
  - You are about to drop the column `maxIncreasePercentage` on the `DynamicPricingConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."DynamicPricingConfig" DROP COLUMN "maxDiscountPercentage",
DROP COLUMN "maxIncreasePercentage";
