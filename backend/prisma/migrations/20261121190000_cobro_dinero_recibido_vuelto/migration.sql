-- Dinero recibido + vuelto en Cobro (efectivo). Defaults compatibles con historicos.
ALTER TABLE "Cobro" ADD COLUMN IF NOT EXISTS "dineroRecibido" DECIMAL(10,2);
ALTER TABLE "Cobro" ADD COLUMN IF NOT EXISTS "vueltoARS" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Historicos: recibido = |monto|, vuelto = 0 (ya default).
UPDATE "Cobro" SET "dineroRecibido" = ABS("monto") WHERE "dineroRecibido" IS NULL;