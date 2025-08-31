const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixActiveBlocks() {
  try {
    console.log('🔧 Arreglando bloques activos...\n');

    const today = new Date();
    console.log(`📅 Fecha actual: ${today.toISOString().split('T')[0]}\n`);

    // Buscar todos los bloques que cubren la fecha actual
    const overlappingBlocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId: 'default-hotel',
        startDate: { lte: today },
        endDate: { gte: today },
        isDraft: false // Solo bloques confirmados
      },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    console.log(`📊 Bloques confirmados que cubren la fecha actual: ${overlappingBlocks.length}`);

    if (overlappingBlocks.length === 0) {
      console.log('❌ No hay bloques confirmados para la fecha actual');
      return;
    }

    // Mostrar información de cada bloque
    overlappingBlocks.forEach((block, index) => {
      console.log(`\n📅 Bloque ${index + 1}: ${block.name}`);
      console.log(`   ID: ${block.id}`);
      console.log(`   Fechas: ${block.startDate.toISOString().split('T')[0]} - ${block.endDate.toISOString().split('T')[0]}`);
      console.log(`   Precios configurados: ${block.seasonPrices.length}`);
      
      // Mostrar algunos precios de ejemplo
      const singlePrices = block.seasonPrices.filter(price => price.roomType.name === 'single');
      if (singlePrices.length > 0) {
        console.log(`   💰 Precios para single:`);
        singlePrices.forEach(price => {
          console.log(`      - ${price.serviceType?.name || 'Sin servicio'}: $${price.basePrice}`);
        });
      }
    });

    if (overlappingBlocks.length === 1) {
      console.log('\n✅ Solo hay un bloque confirmado. No hay conflicto.');
      return;
    }

    // Si hay múltiples bloques, preguntar cuál mantener
    console.log('\n⚠️  Hay múltiples bloques confirmados que cubren la fecha actual.');
    console.log('Esto puede causar confusión en las tarifas mostradas.');
    console.log('\nOpciones:');
    console.log('1. Mantener solo el bloque más reciente (Nuevo Bloque 8/19/2025)');
    console.log('2. Mantener solo el bloque más antiguo (Bloque de prueba de agosto asdx)');
    console.log('3. Ver más detalles antes de decidir');

    // Por ahora, vamos a mantener solo el bloque más reciente (Nuevo Bloque 8/19/2025)
    const blockToKeep = overlappingBlocks[overlappingBlocks.length - 1]; // El último (más reciente)
    const blocksToDeactivate = overlappingBlocks.slice(0, -1); // Todos excepto el último

    console.log(`\n🔄 Desactivando bloques antiguos y manteniendo: ${blockToKeep.name}`);

    // Desactivar los bloques antiguos (marcarlos como borrador)
    for (const block of blocksToDeactivate) {
      console.log(`   Desactivando: ${block.name}`);
      
      await prisma.$transaction(async (tx) => {
        // Marcar el bloque como borrador
        await tx.seasonBlock.update({
          where: { id: block.id },
          data: { isDraft: true }
        });

        // Marcar todos los precios como borrador
        await tx.seasonPrice.updateMany({
          where: { seasonBlockId: block.id },
          data: { isDraft: true }
        });

        // Marcar todas las selecciones de servicios como borrador
        await tx.blockServiceSelection.updateMany({
          where: { seasonBlockId: block.id },
          data: { isDraft: true }
        });
      });
    }

    console.log('\n✅ Bloques desactivados exitosamente.');
    console.log(`✅ Bloque activo: ${blockToKeep.name}`);

    // Verificar el resultado
    console.log('\n🔍 Verificando resultado...');
    const activeBlocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId: 'default-hotel',
        startDate: { lte: today },
        endDate: { gte: today },
        isDraft: false
      },
      include: {
        seasonPrices: {
          where: { roomType: { name: 'single' } },
          include: {
            roomType: true,
            serviceType: true
          }
        }
      }
    });

    console.log(`📊 Bloques confirmados activos: ${activeBlocks.length}`);
    activeBlocks.forEach(block => {
      console.log(`   ✅ ${block.name}`);
      if (block.seasonPrices.length > 0) {
        const basePrice = block.seasonPrices[0].basePrice;
        console.log(`      Precio base para single: $${basePrice}`);
      }
    });

  } catch (error) {
    console.error('❌ Error al arreglar bloques activos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
fixActiveBlocks(); 