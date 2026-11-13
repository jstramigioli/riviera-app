-- Perfil de facturación del cliente (aparte del perfil personal)
CREATE TABLE IF NOT EXISTS "ClientBillingProfile" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "lastInvoiceType" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "address" TEXT,
    "email" TEXT,
    "businessName" TEXT,
    "cuit" TEXT,
    "commercialAddress" TEXT,
    "ivaCondition" TEXT DEFAULT 'Responsable Inscripto',
    "cardNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientBillingProfile_clientId_key" ON "ClientBillingProfile"("clientId");

ALTER TABLE "ClientBillingProfile"
  DROP CONSTRAINT IF EXISTS "ClientBillingProfile_clientId_fkey";
ALTER TABLE "ClientBillingProfile"
  ADD CONSTRAINT "ClientBillingProfile_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Flag de facturación en pago
ALTER TABLE "Pago" ADD COLUMN IF NOT EXISTS "requiereFacturacion" BOOLEAN NOT NULL DEFAULT false;

-- Snapshot de factura por pago
CREATE TABLE IF NOT EXISTS "PagoFactura" (
    "id" SERIAL NOT NULL,
    "pagoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "address" TEXT,
    "email" TEXT,
    "businessName" TEXT,
    "cuit" TEXT,
    "commercialAddress" TEXT,
    "ivaCondition" TEXT,
    "cardNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagoFactura_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PagoFactura_pagoId_key" ON "PagoFactura"("pagoId");

ALTER TABLE "PagoFactura"
  DROP CONSTRAINT IF EXISTS "PagoFactura_pagoId_fkey";
ALTER TABLE "PagoFactura"
  ADD CONSTRAINT "PagoFactura_pagoId_fkey"
  FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
