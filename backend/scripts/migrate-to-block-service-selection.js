const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateToBlockServiceSelection() {
  console.log('🚀 Iniciando migración a BlockServiceSelection...');

  try {
    // 1. Migrar ServiceAdjustment existentes
    console.log('📊 Migrando ServiceAdjustment existentes...');
    const serviceAdjustments = await prisma.serviceAdjustment.findMany({
      include: {
        seasonBlock: true,
        serviceType: true
      }
    });

    for (const adjustment of serviceAdjustments) {
      await prisma.blockServiceSelection.upsert({
        where: {
          seasonBlockId_serviceTypeId: {
            seasonBlockId: adjustment.seasonBlockId,
            serviceTypeId: adjustment.serviceTypeId
          }
        },
        update: {
          isEnabled: true,
          pricingMode: adjustment.mode,
          fixedPrice: adjustment.mode === 'FIXED' ? adjustment.value : null,
          percentage: adjustment.mode === 'PERCENTAGE' ? adjustment.value : null,
          orderIndex: adjustment.serviceType.orderIndex
        },
        create: {
          seasonBlockId: adjustment.seasonBlockId,
          serviceTypeId: adjustment.serviceTypeId,
          isEnabled: true,
          pricingMode: adjustment.mode,
          fixedPrice: adjustment.mode === 'FIXED' ? adjustment.value : null,
          percentage: adjustment.mode === 'PERCENTAGE' ? adjustment.value : null,
          orderIndex: adjustment.serviceType.orderIndex
        }
      });
    }

    console.log(`✅ Migrados ${serviceAdjustments.length} ServiceAdjustment`);

    // 2. Migrar BlockServiceType existentes
    console.log('📊 Migrando BlockServiceType existentes...');
    const blockServiceTypes = await prisma.blockServiceType.findMany({
      include: {
        seasonBlock: true
      }
    });

    for (const blockServiceType of blockServiceTypes) {
      // Crear un ServiceType global si no existe
      let serviceType = await prisma.serviceType.findFirst({
        where: {
          hotelId: blockServiceType.seasonBlock.hotelId,
          name: blockServiceType.name
        }
      });

      if (!serviceType) {
        serviceType = await prisma.serviceType.create({
          data: {
            hotelId: blockServiceType.seasonBlock.hotelId,
            name: blockServiceType.name,
            description: blockServiceType.description,
            isActive: blockServiceType.isActive,
            orderIndex: blockServiceType.orderIndex
          }
        });
      }

      // Crear BlockServiceSelection
      await prisma.blockServiceSelection.upsert({
        where: {
          seasonBlockId_serviceTypeId: {
            seasonBlockId: blockServiceType.seasonBlockId,
            serviceTypeId: serviceType.id
          }
        },
        update: {
          isEnabled: blockServiceType.isActive,
          pricingMode: blockServiceType.adjustmentMode,
          fixedPrice: blockServiceType.adjustmentMode === 'FIXED' ? blockServiceType.adjustmentValue : null,
          percentage: blockServiceType.adjustmentMode === 'PERCENTAGE' ? blockServiceType.adjustmentValue : null,
          orderIndex: blockServiceType.orderIndex
        },
        create: {
          seasonBlockId: blockServiceType.seasonBlockId,
          serviceTypeId: serviceType.id,
          isEnabled: blockServiceType.isActive,
          pricingMode: blockServiceType.adjustmentMode,
          fixedPrice: blockServiceType.adjustmentMode === 'FIXED' ? blockServiceType.adjustmentValue : null,
          percentage: blockServiceType.adjustmentMode === 'PERCENTAGE' ? blockServiceType.adjustmentValue : null,
          orderIndex: blockServiceType.orderIndex
        }
      });
    }

    console.log(`✅ Migrados ${blockServiceTypes.length} BlockServiceType`);

    // 3. Crear BlockServiceSelection para servicios globales que no tengan selección
    console.log('📊 Creando selecciones para servicios globales...');
    const seasonBlocks = await prisma.seasonBlock.findMany({
      include: {
        hotel: {
          include: {
            serviceTypes: true
          }
        }
      }
    });

    for (const block of seasonBlocks) {
      for (const serviceType of block.hotel.serviceTypes) {
        const existingSelection = await prisma.blockServiceSelection.findUnique({
          where: {
            seasonBlockId_serviceTypeId: {
              seasonBlockId: block.id,
              serviceTypeId: serviceType.id
            }
          }
        });

        if (!existingSelection) {
          await prisma.blockServiceSelection.create({
            data: {
              seasonBlockId: block.id,
              serviceTypeId: serviceType.id,
              isEnabled: true,
              pricingMode: 'PERCENTAGE',
              percentage: 0,
              orderIndex: serviceType.orderIndex
            }
          });
        }
      }
    }

    console.log('✅ Migración completada exitosamente');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar migración
migrateToBlockServiceSelection()
  .then(() => {
    console.log('🎉 Migración completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error en migración:', error);
    process.exit(1);
  }); 