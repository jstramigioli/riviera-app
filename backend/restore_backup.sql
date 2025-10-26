-- Script para restaurar el backup y actualizar los campos multimoneda

-- Primero restaurar el backup
\i backup_antes_multimoneda_20251026_171404.sql

-- Actualizar los registros de Pago para que tengan los campos requeridos
UPDATE "Pago" 
SET 
  "moneda" = 'ARS',
  "montoARS" = "monto"
WHERE "moneda" IS NULL OR "montoARS" IS NULL;

-- Verificar que todos los registros tengan los campos requeridos
SELECT COUNT(*) as total_pagos FROM "Pago";
SELECT COUNT(*) as pagos_con_moneda FROM "Pago" WHERE "moneda" IS NOT NULL;
SELECT COUNT(*) as pagos_con_monto_ars FROM "Pago" WHERE "montoARS" IS NOT NULL;
