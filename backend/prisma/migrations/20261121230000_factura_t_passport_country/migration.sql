-- Factura T: país emisor del pasaporte extranjero (mismo snapshot persona que B).
ALTER TABLE "ClientBillingProfile" ADD COLUMN IF NOT EXISTS "passportCountry" TEXT;
ALTER TABLE "CobroFactura" ADD COLUMN IF NOT EXISTS "passportCountry" TEXT;
