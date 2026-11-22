-- Fecha de nacimiento del cliente (nullable) + snapshot en check-in online.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "OnlineCheckIn" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
