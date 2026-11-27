-- Beneficio gastronómico «Almuerzo sin cargo» (por cena incluida cancelada)
-- y líneas de comanda bonificadas (sin Cargo).

DO $$ BEGIN
  CREATE TYPE "TipoBeneficio" AS ENUM ('ALMUERZO_SIN_CARGO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoBeneficio" AS ENUM ('DISPONIBLE', 'UTILIZADO', 'ANULADO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MotivoAnulacionBeneficio" AS ENUM ('CHECKOUT', 'CENA_REACTIVADA', 'FUERA_DE_ESTADIA', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ComandaItem" ADD COLUMN IF NOT EXISTS "bonificado" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "BeneficioGastronomico" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoBeneficio" NOT NULL DEFAULT 'ALMUERZO_SIN_CARGO',
    "estado" "EstadoBeneficio" NOT NULL DEFAULT 'DISPONIBLE',
    "reservationId" INTEGER NOT NULL,
    "prestacionId" INTEGER NOT NULL,
    "comandaId" INTEGER,
    "utilizadoAt" TIMESTAMP(3),
    "anuladoAt" TIMESTAMP(3),
    "motivoAnulacion" "MotivoAnulacionBeneficio",
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeneficioGastronomico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BeneficioGastronomico_prestacionId_key" ON "BeneficioGastronomico"("prestacionId");
CREATE UNIQUE INDEX IF NOT EXISTS "BeneficioGastronomico_comandaId_key" ON "BeneficioGastronomico"("comandaId");
CREATE INDEX IF NOT EXISTS "BeneficioGastronomico_reservationId_estado_idx" ON "BeneficioGastronomico"("reservationId", "estado");

DO $$ BEGIN
  ALTER TABLE "BeneficioGastronomico" ADD CONSTRAINT "BeneficioGastronomico_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BeneficioGastronomico" ADD CONSTRAINT "BeneficioGastronomico_prestacionId_fkey" FOREIGN KEY ("prestacionId") REFERENCES "PrestacionComida"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BeneficioGastronomico" ADD CONSTRAINT "BeneficioGastronomico_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Cenas incluidas ya canceladas (antes de existir el beneficio): generar el suyo.
-- Si la reserva ya está finalizada, queda anulado por check-out.
INSERT INTO "BeneficioGastronomico" ("reservationId", "prestacionId", "estado", "anuladoAt", "motivoAnulacion", "updatedAt")
SELECT
  p."reservationId",
  p."id",
  CASE WHEN r."status" = 'FINALIZADA' THEN 'ANULADO'::"EstadoBeneficio" ELSE 'DISPONIBLE'::"EstadoBeneficio" END,
  CASE WHEN r."status" = 'FINALIZADA' THEN CURRENT_TIMESTAMP ELSE NULL END,
  CASE WHEN r."status" = 'FINALIZADA' THEN 'CHECKOUT'::"MotivoAnulacionBeneficio" ELSE NULL END,
  CURRENT_TIMESTAMP
FROM "PrestacionComida" p
JOIN "Reservation" r ON r."id" = p."reservationId"
WHERE p."origen" = 'REGIMEN'
  AND p."tipo" = 'CENA'
  AND p."estado" = 'CANCELADA'
  AND p."vigente" = true
  AND r."status" NOT IN ('CANCELADA', 'NO_PRESENTADA')
ON CONFLICT ("prestacionId") DO NOTHING;
