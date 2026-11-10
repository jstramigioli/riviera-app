-- Drop proportion system completely
DROP TABLE IF EXISTS "public"."ProportionCoefficient";
ALTER TABLE "public"."SeasonBlock" DROP COLUMN IF EXISTS "useProportions";
