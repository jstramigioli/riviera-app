/*
  Warnings:

  - You are about to drop the column `demandIndexWeight` on the `DynamicPricingConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."DynamicPricingConfig" DROP COLUMN "demandIndexWeight";
