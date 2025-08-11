-- Crear nueva tabla para tipos de servicio específicos de cada bloque
CREATE TABLE "BlockServiceType" (
    "id" TEXT NOT NULL,
    "seasonBlockId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "adjustmentMode" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "adjustmentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockServiceType_pkey" PRIMARY KEY ("id")
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX "BlockServiceType_seasonBlockId_idx" ON "BlockServiceType"("seasonBlockId");
CREATE INDEX "BlockServiceType_orderIndex_idx" ON "BlockServiceType"("orderIndex");

-- Agregar restricción única para evitar duplicados
ALTER TABLE "BlockServiceType" ADD CONSTRAINT "BlockServiceType_seasonBlockId_name_key" UNIQUE ("seasonBlockId", "name");

-- Agregar restricción de clave foránea
ALTER TABLE "BlockServiceType" ADD CONSTRAINT "BlockServiceType_seasonBlockId_fkey" FOREIGN KEY ("seasonBlockId") REFERENCES "SeasonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Agregar columna para indicar si el bloque usa el sistema de servicios por bloque
ALTER TABLE "SeasonBlock" ADD COLUMN "useBlockServices" BOOLEAN NOT NULL DEFAULT false;

-- Agregar columna para el precio base del bloque (precio de referencia)
ALTER TABLE "SeasonBlock" ADD COLUMN "basePrice" DOUBLE PRECISION;

-- Comentarios para documentar el nuevo sistema
COMMENT ON TABLE "BlockServiceType" IS 'Tipos de servicio específicos de cada bloque de temporada';
COMMENT ON COLUMN "BlockServiceType.adjustmentMode" IS 'PERCENTAGE para porcentaje del precio base, FIXED para precio fijo';
COMMENT ON COLUMN "BlockServiceType.adjustmentValue" IS 'Valor del ajuste (porcentaje o monto fijo)';
COMMENT ON COLUMN "SeasonBlock.useBlockServices" IS 'Indica si el bloque usa el nuevo sistema de servicios por bloque';
COMMENT ON COLUMN "SeasonBlock.basePrice" IS 'Precio base de referencia para el bloque (tipo de habitación base)'; 