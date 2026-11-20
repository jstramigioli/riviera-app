-- CreateEnum
CREATE TYPE "MenuCategory" AS ENUM ('BEBIDAS', 'MINUTAS', 'CAFETERIA');

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" SERIAL NOT NULL,
    "category" "MenuCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ordenIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItem_category_isActive_idx" ON "MenuItem"("category", "isActive");

-- CreateIndex
CREATE INDEX "MenuItem_name_idx" ON "MenuItem"("name");

-- Asegurar subcategorías CONSUMO canónicas para cargos de comanda
INSERT INTO "SubcategoriaCargo" ("tipo", "codigo", "nombre", "descripcion", "color", "esActivo", "ordenIndex", "createdAt", "updatedAt")
VALUES
  ('CONSUMO', 'BEBIDAS', 'Bebidas', 'Consumos de bebidas', '#3f5f8a', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CONSUMO', 'MINUTAS', 'Minutas', 'Consumos de minutas / cocina', '#5a6f85', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CONSUMO', 'CAFETERIA', 'Cafetería', 'Consumos de cafetería', '#6b7280', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tipo", "codigo") DO NOTHING;

-- Seed inicial de ítems de menú (editables desde Configuración)
INSERT INTO "MenuItem" ("category", "name", "price", "description", "isActive", "ordenIndex", "createdAt", "updatedAt")
VALUES
  ('BEBIDAS', 'Agua mineral', 1500.00, NULL, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('BEBIDAS', 'Gaseosa', 2000.00, NULL, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('BEBIDAS', 'Cerveza', 3500.00, NULL, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('BEBIDAS', 'Vino copa', 4000.00, NULL, true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('MINUTAS', 'Sandwich jamón y queso', 5500.00, NULL, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('MINUTAS', 'Ensalada mixta', 6000.00, NULL, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('MINUTAS', 'Milanesa con guarnición', 9500.00, NULL, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CAFETERIA', 'Café', 1800.00, NULL, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CAFETERIA', 'Café con leche', 2200.00, NULL, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CAFETERIA', 'Té', 1600.00, NULL, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CAFETERIA', 'Medialuna', 1200.00, NULL, true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
