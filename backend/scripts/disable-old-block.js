const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function disableOldBlock() {
  try {
    console.log('🔧 Desactivando bloque antiguo...\n');

    // ID del bloque antiguo que tiene precios de $5,000
    const oldBlockId = 'cme7uwqua0013nwg5xdu9kfmg'; // Bloque de prueba de agosto asdx
    
    console.log(`🎯 Desactivando bloque: ${oldBlockId}`);

    // Verificar que el bloque existe
    const oldBlock = await prisma.seasonBlock.findUnique({
      where: { id: oldBlockId },
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

    if (!oldBlock) {
      console.log('❌ Bloque no encontrado');
      return;
    }

    console.log(`📅 Bloque encontrado: ${oldBlock.name}`);
    console.log(`   Fechas: ${oldBlock.startDate.toISOString().split('T')[0]} - ${oldBlock.endDate.toISOString().split('T')[0]}`);
    console.log(`   Estado actual: ${oldBlock.isDraft ? 'BORRADOR' : 'CONFIRMADO'}`);
    
    if (oldBlock.seasonPrices.length > 0) {
      console.log(`   💰 Precios para single:`);
      oldBlock.seasonPrices.forEach(price => {
        console.log(`      - ${price.serviceType?.name || 'Sin servicio'}: $${price.basePrice}`);
      });
    }

    // Desactivar el bloque (marcarlo como borrador)
    console.log('\n🔄 Desactivando bloque...');
    
    await prisma.$transaction(async (tx) => {
      // Marcar el bloque como borrador
      await tx.seasonBlock.update({
        where: { id: oldBlockId },
        data: { isDraft: true }
      });

      // Marcar todos los precios como borrador
      await tx.seasonPrice.updateMany({
        where: { seasonBlockId: oldBlockId },
        data: { isDraft: true }
      });

      // Marcar todas las selecciones de servicios como borrador
      await tx.blockServiceSelection.updateMany({
        where: { seasonBlockId: oldBlockId },
        data: { isDraft: true }
      });
    });

    console.log('✅ Bloque desactivado exitosamente');

    // Verificar el resultado
    console.log('\n🔍 Verificando resultado...');
    const updatedBlock = await prisma.seasonBlock.findUnique({
      where: { id: oldBlockId }
    });

    console.log(`   Estado después: ${updatedBlock.isDraft ? 'BORRADOR' : 'CONFIRMADO'}`);

    // Verificar qué bloque está activo ahora
    const today = new Date();
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

    console.log(`\n📊 Bloques confirmados activos: ${activeBlocks.length}`);
    activeBlocks.forEach(block => {
      console.log(`   ✅ ${block.name}`);
      if (block.seasonPrices.length > 0) {
        const basePrice = block.seasonPrices[0].basePrice;
        console.log(`      Precio base para single: $${basePrice}`);
      }
    });

    if (activeBlocks.length === 1) {
      console.log('\n🎉 ¡Perfecto! Ahora solo hay un bloque activo con los precios correctos.');
    } else if (activeBlocks.length === 0) {
      console.log('\n⚠️  No hay bloques confirmados activos.');
    } else {
      console.log('\n⚠️  Aún hay múltiples bloques confirmados.');
    }

  } catch (error) {
    console.error('❌ Error al desactivar bloque:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
disableOldBlock(); 