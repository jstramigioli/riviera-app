-- Comandas de consumo con ámbito (Cena / Minutas / Cafetería / Frigobar).
-- Cada línea guarda el precio del momento; las líneas con cargo apuntan a su Cargo.
-- Los consumos cargados antes de esta migración quedan sin comanda (históricos).

DO $$ BEGIN
  CREATE TYPE "AmbitoConsumo" AS ENUM ('CENA', 'MINUTAS', 'CAFETERIA', 'FRIGOBAR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ComandaEstado" AS ENUM ('ACTIVA', 'ANULADA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Comanda" (
    "id" SERIAL NOT NULL,
    "ambito" "AmbitoConsumo" NOT NULL,
    "estado" "ComandaEstado" NOT NULL DEFAULT 'ACTIVA',
    "fecha" DATE NOT NULL,
    "accountId" INTEGER NOT NULL,
    "reservationId" INTEGER,
    "notas" TEXT,
    "anuladaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comanda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComandaItem" (
    "id" SERIAL NOT NULL,
    "comandaId" INTEGER NOT NULL,
    "menuItemId" INTEGER,
    "varietyId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "cargoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComandaItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Comanda_accountId_idx" ON "Comanda"("accountId");
CREATE INDEX IF NOT EXISTS "Comanda_reservationId_idx" ON "Comanda"("reservationId");
CREATE INDEX IF NOT EXISTS "Comanda_ambito_fecha_idx" ON "Comanda"("ambito", "fecha");
CREATE INDEX IF NOT EXISTS "Comanda_fecha_idx" ON "Comanda"("fecha");
CREATE UNIQUE INDEX IF NOT EXISTS "ComandaItem_cargoId_key" ON "ComandaItem"("cargoId");
CREATE INDEX IF NOT EXISTS "ComandaItem_comandaId_idx" ON "ComandaItem"("comandaId");
CREATE INDEX IF NOT EXISTS "ComandaItem_menuItemId_idx" ON "ComandaItem"("menuItemId");

DO $$ BEGIN
  ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "MenuItemVariety"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Grupo de menú «Cenas» (subcategoría de cargo CONSUMO) y sus 8 productos.
-- Precio inicial 0: se configura en Configuración → Menú.
INSERT INTO "SubcategoriaCargo" ("tipo", "codigo", "nombre", "descripcion", "color", "esActivo", "ordenIndex", "updatedAt")
VALUES ('CONSUMO', 'CENAS', 'Cenas', 'Cenas (habitual, buffet, fiestas)', '#334d70', true, 40, CURRENT_TIMESTAMP)
ON CONFLICT ("tipo", "codigo") DO NOTHING;

INSERT INTO "MenuItem" ("category", "name", "price", "isActive", "ordenIndex", "updatedAt")
SELECT 'CENAS', v.name, 0, true, v.orden, CURRENT_TIMESTAMP
FROM (VALUES
  ('Cena habitual - Alojado', 10),
  ('Cena habitual - Externo', 20),
  ('Cena buffet - Alojado', 30),
  ('Cena buffet - Externo', 40),
  ('Cena Navidad - Alojado', 50),
  ('Cena Navidad - Externo', 60),
  ('Cena Año Nuevo - Alojado', 70),
  ('Cena Año Nuevo - Externo', 80)
) AS v(name, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM "MenuItem" m WHERE m."category" = 'CENAS' AND m."name" = v.name
);
