-- Categorias del catalogo de platos (1o/2o plato -> PLATO_PRINCIPAL).
CREATE TYPE "DishCatalogCategory" AS ENUM (
  'ENTRADA',
  'ENSALADA',
  'SOPA',
  'PLATO_PRINCIPAL',
  'PLATO_INFANTIL',
  'POSTRE',
  'BUFFET'
);

ALTER TABLE "DishCatalog" ADD COLUMN "category" "DishCatalogCategory";

-- Backfill desde la seccion mas usada en menus; PRIMER/SEGUNDO -> PLATO_PRINCIPAL.
UPDATE "DishCatalog" d
SET "category" = CASE sec.mode_section
  WHEN 'PRIMER_PLATO' THEN 'PLATO_PRINCIPAL'::"DishCatalogCategory"
  WHEN 'SEGUNDO_PLATO' THEN 'PLATO_PRINCIPAL'::"DishCatalogCategory"
  WHEN 'ENTRADA' THEN 'ENTRADA'::"DishCatalogCategory"
  WHEN 'ENSALADA' THEN 'ENSALADA'::"DishCatalogCategory"
  WHEN 'SOPA' THEN 'SOPA'::"DishCatalogCategory"
  WHEN 'PLATO_INFANTIL' THEN 'PLATO_INFANTIL'::"DishCatalogCategory"
  WHEN 'POSTRE' THEN 'POSTRE'::"DishCatalogCategory"
  WHEN 'BUFFET' THEN 'BUFFET'::"DishCatalogCategory"
  ELSE NULL
END
FROM (
  SELECT
    "dishCatalogId",
    mode() WITHIN GROUP (ORDER BY section::text) AS mode_section
  FROM "DailyMenuItem"
  WHERE "dishCatalogId" IS NOT NULL
  GROUP BY "dishCatalogId"
) AS sec
WHERE d.id = sec."dishCatalogId";

-- Sin historial: heuristica suave por nombre, si no ENTRADA.
UPDATE "DishCatalog"
SET "category" = CASE
  WHEN "nameNorm" LIKE '%sopa%' OR "nameNorm" LIKE '%creme%' OR "nameNorm" LIKE '%crema%' OR "nameNorm" LIKE '%consom%'
    THEN 'SOPA'::"DishCatalogCategory"
  WHEN "nameNorm" LIKE '%ensalad%'
    THEN 'ENSALADA'::"DishCatalogCategory"
  WHEN "nameNorm" LIKE '%flan%' OR "nameNorm" LIKE '%helado%' OR "nameNorm" LIKE '%tarta%' OR "nameNorm" LIKE '%postre%' OR "nameNorm" LIKE '%mousse%' OR "nameNorm" LIKE '%budin%' OR "nameNorm" LIKE '%torta%' OR "nameNorm" LIKE '%tiramisu%' OR "nameNorm" LIKE '%compota%' OR "nameNorm" LIKE '%durazno%' OR "nameNorm" LIKE '%pera%'
    THEN 'POSTRE'::"DishCatalogCategory"
  ELSE 'ENTRADA'::"DishCatalogCategory"
END
WHERE "category" IS NULL;

ALTER TABLE "DishCatalog" ALTER COLUMN "category" SET NOT NULL;

DROP INDEX IF EXISTS "DishCatalog_nameNorm_key";

CREATE UNIQUE INDEX "DishCatalog_nameNorm_category_key" ON "DishCatalog"("nameNorm", "category");

CREATE INDEX "DishCatalog_category_idx" ON "DishCatalog"("category");
