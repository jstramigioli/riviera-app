/*
  Warnings:

  - You are about to drop the `SeasonalKeyframe` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."SeasonalKeyframe" DROP CONSTRAINT "SeasonalKeyframe_hotelId_fkey";

-- DropTable
DROP TABLE "public"."SeasonalKeyframe";
