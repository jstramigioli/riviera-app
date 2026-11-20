-- PGH-136: grupos de menú configurables + subgrupos tipados.
-- category deja de ser enum; liquidación CONSUMO canónica = BEBIDAS/MINUTAS/CAFETERIA (SNACKS off).

-- 1) MenuItem.category: enum → TEXT
ALTER TABLE "MenuItem" ALTER COLUMN "category" TYPE TEXT USING ("category"::text);
DROP TYPE IF EXISTS "MenuCategory";

-- 2) Catálogo de subgrupos
CREATE TABLE IF NOT EXISTS "MenuSubgroup" (
  "id" SERIAL PRIMARY KEY,
  "category" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ordenIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "MenuSubgroup_category_name_key"
  ON "MenuSubgroup"("category", "name");

CREATE INDEX IF NOT EXISTS "MenuSubgroup_category_ordenIndex_idx"
  ON "MenuSubgroup"("category", "ordenIndex");

-- Seed desde subgrupos ya usados en el menú
INSERT INTO "MenuSubgroup" ("category", "name", "ordenIndex", "updatedAt")
SELECT
  mi.category,
  TRIM(mi.subgroup),
  (ROW_NUMBER() OVER (PARTITION BY mi.category ORDER BY MIN(mi."ordenIndex"), TRIM(mi.subgroup)) * 10)::int,
  CURRENT_TIMESTAMP
FROM "MenuItem" mi
WHERE mi.subgroup IS NOT NULL AND TRIM(mi.subgroup) <> ''
GROUP BY mi.category, TRIM(mi.subgroup)
ON CONFLICT ("category", "name") DO NOTHING;

-- 3) Subcategorías CONSUMO canónicas para menú / liquidación
INSERT INTO "SubcategoriaCargo" ("tipo", "codigo", "nombre", "descripcion", "color", "esActivo", "ordenIndex", "updatedAt")
VALUES
  ('CONSUMO', 'BEBIDAS', 'Bebidas', 'Consumos de bebidas', '#3f5f8a', true, 10, CURRENT_TIMESTAMP),
  ('CONSUMO', 'MINUTAS', 'Minutas', 'Consumos de minutas / cocina', '#5a6f85', true, 20, CURRENT_TIMESTAMP),
  ('CONSUMO', 'CAFETERIA', 'Cafetería', 'Consumos de cafetería', '#6b7280', true, 30, CURRENT_TIMESTAMP)
ON CONFLICT ("tipo", "codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "descripcion" = EXCLUDED."descripcion",
  "esActivo" = true,
  "ordenIndex" = EXCLUDED."ordenIndex",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Quitar Snacks hardcoded del set de liquidación / menú
UPDATE "SubcategoriaCargo"
SET "esActivo" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "tipo" = 'CONSUMO' AND "codigo" = 'SNACKS';
