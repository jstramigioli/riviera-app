const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function confirmActiveDraftBlock() {
  try {
    console.log('🔍 Buscando bloque en borrador activo para confirmar...\n');

    const today = new Date();
    console.log(`📅 Fecha actual: ${today.toISOString().split('T')[0]}\n`);

    // Buscar bloques en borrador que cubran la fecha actual
    const draftBlocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId: 'default-hotel',
        isDraft: true,
        startDate: { lte: today },
        endDate: { gte: today }
      },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        },
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    if (draftBlocks.length === 0) {
      console.log('❌ No hay bloques en borrador que cubran la fecha actual');
      return;
    }

    console.log(`📊 Bloques en borrador encontrados: ${draftBlocks.length}\n`);

    // Mostrar información de los bloques encontrados
    draftBlocks.forEach((block, index) => {
      console.log(`📅 Bloque ${index + 1}: ${block.name}`);
      console.log(`   ID: ${block.id}`);
      console.log(`   Fechas: ${block.startDate.toISOString().split('T')[0]} - ${block.endDate.toISOString().split('T')[0]}`);
      console.log(`   Precios configurados: ${block.seasonPrices.length}`);
      console.log(`   Servicios configurados: ${block.blockServiceSelections.length}`);
      console.log('');
    });

    // Confirmar el primer bloque encontrado
    const blockToConfirm = draftBlocks[0];
    console.log(`✅ Confirmando bloque: ${blockToConfirm.name}\n`);

    // Confirmar el bloque en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Marcar el bloque como confirmado
      const confirmedBlock = await tx.seasonBlock.update({
        where: { id: blockToConfirm.id },
        data: {
          isDraft: false,
          lastSavedAt: new Date()
        }
      });

      // Marcar todos los precios como confirmados
      await tx.seasonPrice.updateMany({
        where: { seasonBlockId: blockToConfirm.id },
        data: { isDraft: false }
      });

      // Marcar todas las selecciones de servicios como confirmadas
      await tx.blockServiceSelection.updateMany({
        where: { seasonBlockId: blockToConfirm.id },
        data: { isDraft: false }
      });

      return confirmedBlock;
    });

    console.log(`✅ Bloque confirmado exitosamente:`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Nombre: ${result.name}`);
    console.log(`   Estado: ${result.isDraft ? 'BORRADOR' : 'CONFIRMADO'}`);
    console.log(`   Última modificación: ${result.lastSavedAt.toISOString()}\n`);

    // Mostrar los precios confirmados
    console.log(`💰 Precios confirmados:`);
    blockToConfirm.seasonPrices.forEach(price => {
      console.log(`   - ${price.roomType.name}: $${price.basePrice}`);
    });

    console.log(`\n🎉 El bloque "${blockToConfirm.name}" ahora está activo y será usado en las nuevas consultas.`);

  } catch (error) {
    console.error('❌ Error al confirmar el bloque:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
confirmActiveDraftBlock(); 