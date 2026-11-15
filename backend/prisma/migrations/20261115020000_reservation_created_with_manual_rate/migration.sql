-- Precio manual de estadía en Consulta (flag a nivel reserva).
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "createdWithManualRate" BOOLEAN NOT NULL DEFAULT false;
