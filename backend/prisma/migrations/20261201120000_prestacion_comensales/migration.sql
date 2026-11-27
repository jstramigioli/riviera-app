-- Detalle por comensal de las cenas manuales (edad y dietas).
ALTER TABLE "PrestacionComida" ADD COLUMN IF NOT EXISTS "comensales" JSONB;
