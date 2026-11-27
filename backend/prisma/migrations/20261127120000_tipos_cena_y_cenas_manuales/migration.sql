-- 1) Tipos de cena flexibles: cada tipo es un producto del grupo CENAS con dos
--    variedades de precio (Alojado / Externo). Convierte los 8 productos
--    «Cena X - Alojado/Externo» sembrados antes en 4 tipos con variedades,
--    conservando precios y repuntando líneas de comanda existentes.
-- 2) Cenas manuales: datos del externo y comanda de Cena asociada.

INSERT INTO "MenuItem" ("category", "name", "price", "isActive", "ordenIndex", "updatedAt")
SELECT 'CENAS', t.nombre, 0, true, t.orden, CURRENT_TIMESTAMP
FROM (VALUES
  ('Cena habitual', 10),
  ('Cena buffet', 20),
  ('Cena Navidad', 30),
  ('Cena Año Nuevo', 40)
) AS t(nombre, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM "MenuItem" m WHERE m."category" = 'CENAS' AND m."name" = t.nombre
);

INSERT INTO "MenuItemVariety" ("menuItemId", "name", "price", "ordenIndex", "updatedAt")
SELECT tipo."id", v.variedad, COALESCE(viejo."price", 0), v.orden, CURRENT_TIMESTAMP
FROM "MenuItem" tipo
CROSS JOIN (VALUES ('Alojado', 0), ('Externo', 1)) AS v(variedad, orden)
LEFT JOIN "MenuItem" viejo
  ON viejo."category" = 'CENAS' AND viejo."name" = tipo."name" || ' - ' || v.variedad
WHERE tipo."category" = 'CENAS'
  AND tipo."name" IN ('Cena habitual', 'Cena buffet', 'Cena Navidad', 'Cena Año Nuevo')
ON CONFLICT ("menuItemId", "name") DO NOTHING;

UPDATE "ComandaItem" ci
SET "menuItemId" = tipo."id", "varietyId" = var."id"
FROM "MenuItem" viejo, "MenuItem" tipo, "MenuItemVariety" var
WHERE ci."menuItemId" = viejo."id"
  AND viejo."category" = 'CENAS'
  AND tipo."category" = 'CENAS'
  AND var."menuItemId" = tipo."id"
  AND viejo."name" = tipo."name" || ' - ' || var."name";

DELETE FROM "MenuItem" viejo
WHERE viejo."category" = 'CENAS'
  AND EXISTS (
    SELECT 1 FROM "MenuItem" tipo
    WHERE tipo."category" = 'CENAS'
      AND viejo."name" IN (tipo."name" || ' - Alojado', tipo."name" || ' - Externo')
  );

ALTER TABLE "PrestacionComida" ADD COLUMN IF NOT EXISTS "nombreExterno" TEXT;
ALTER TABLE "PrestacionComida" ADD COLUMN IF NOT EXISTS "telefono" TEXT;
ALTER TABLE "PrestacionComida" ADD COLUMN IF NOT EXISTS "comandaId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "PrestacionComida_comandaId_key" ON "PrestacionComida"("comandaId");

DO $$ BEGIN
  ALTER TABLE "PrestacionComida" ADD CONSTRAINT "PrestacionComida_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
