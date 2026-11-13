-- Códigos de pago A000…A999, luego B000…
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "codigo" TEXT;

-- Asignar códigos a pagos existentes sin código (orden estable por id)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) - 1 AS seq
  FROM "Pago"
  WHERE "codigo" IS NULL
)
UPDATE "Pago" p
SET "codigo" = chr(65 + (ordered.seq / 1000)::int) || lpad((ordered.seq % 1000)::text, 3, '0')
FROM ordered
WHERE p.id = ordered.id;

ALTER TABLE "Pago" ALTER COLUMN "codigo" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Pago_codigo_key" ON "Pago"("codigo");

-- Pagos cargados solo con fecha (00:00): usar createdAt para conservar hora real
UPDATE "Pago"
SET "fecha" = "createdAt"
WHERE "fecha"::time = TIME '00:00:00';
