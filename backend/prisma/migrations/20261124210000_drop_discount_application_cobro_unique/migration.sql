-- 20261119010000 used DROP CONSTRAINT, but the unique was CREATE UNIQUE INDEX
-- (DiscountApplication_pagoId_key). After pagoId->cobroId rename the index remained
-- on cobroId and breaks multi-imputacion with bonificacion (2+ DA per cobro).
DROP INDEX IF EXISTS "DiscountApplication_pagoId_key";
