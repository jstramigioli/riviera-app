const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNewQueryRates() {
  try {
    console.log('🧪 Probando tarifas de nueva consulta...\n');

    const testDate = new Date().toISOString().split('T')[0]; // Fecha actual
    const hotelId = 'default-hotel';
    
    console.log(`📅 Fecha de prueba: ${testDate}`);
    console.log(`🏨 Hotel ID: ${hotelId}\n`);

    // Simular la lógica del endpoint /api/season-blocks/active
    console.log('🔍 Buscando bloque activo...');
    
    const targetDate = new Date(testDate);
    
    // Buscar bloques que cubran la fecha (tanto borradores como confirmados)
    const seasonBlocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate }
      },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        }
      },
      orderBy: { isDraft: 'asc' } // Primero los confirmados, luego los borradores
    });

    console.log(`📊 Bloques encontrados para la fecha: ${seasonBlocks.length}`);

    if (seasonBlocks.length === 0) {
      console.log('❌ No hay bloques para esta fecha');
      return;
    }

    // Mostrar todos los bloques encontrados
    seasonBlocks.forEach((block, index) => {
      console.log(`   ${index + 1}. ${block.name} (${block.isDraft ? 'BORRADOR' : 'CONFIRMADO'})`);
    });

    // Buscar el primer bloque confirmado (no borrador)
    const activeBlock = seasonBlocks.find(block => !block.isDraft);
    
    if (!activeBlock) {
      console.log('\n⚠️  No hay bloques confirmados para esta fecha');
      
      // Solo hay borradores
      const draftBlocks = seasonBlocks.filter(block => block.isDraft);
      console.log(`📋 Bloques en borrador disponibles:`);
      draftBlocks.forEach(block => {
        console.log(`   - ${block.name} (ID: ${block.id})`);
      });
      
      // Simular el uso del primer bloque en borrador
      if (draftBlocks.length > 0) {
        const draftBlock = draftBlocks[0];
        console.log(`\n🟡 Usando bloque en borrador: ${draftBlock.name}`);
        await showBlockPrices(draftBlock, 'borrador');
      }
    } else {
      console.log(`\n✅ Bloque activo encontrado: ${activeBlock.name}`);
      await showBlockPrices(activeBlock, 'confirmado');
    }

    // También probar con habitaciones específicas
    console.log('\n🏠 Probando con habitaciones específicas...');
    
    const rooms = await prisma.room.findMany({
      include: {
        roomType: true
      },
      take: 3 // Solo las primeras 3 habitaciones
    });

    if (activeBlock) {
      console.log(`\n💰 Tarifas para habitaciones (desde bloque confirmado):`);
      rooms.forEach(room => {
        const roomTypePrice = activeBlock.seasonPrices.find(
          price => price.roomTypeId === room.roomType.id
        );
        
        if (roomTypePrice) {
          const baseRate = roomTypePrice.basePrice;
          const withBreakfast = Math.round(baseRate * 1.15);
          const withHalfBoard = Math.round(baseRate * 1.35);
          
          console.log(`   ${room.name} (${room.roomType.name}):`);
          console.log(`     - Base: $${baseRate}`);
          console.log(`     - Con desayuno: $${withBreakfast}`);
          console.log(`     - Media pensión: $${withHalfBoard}`);
        } else {
          console.log(`   ${room.name} (${room.roomType.name}): ❌ Sin precio configurado`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error al probar tarifas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function showBlockPrices(block, type) {
  console.log(`\n💰 Precios del bloque ${type} "${block.name}":`);
  
  // Agrupar precios por tipo de habitación
  const pricesByRoomType = {};
  block.seasonPrices.forEach(price => {
    const roomTypeName = price.roomType.name;
    if (!pricesByRoomType[roomTypeName]) {
      pricesByRoomType[roomTypeName] = [];
    }
    pricesByRoomType[roomTypeName].push(price);
  });

  Object.entries(pricesByRoomType).forEach(([roomTypeName, prices]) => {
    console.log(`   ${roomTypeName}:`);
    prices.forEach(price => {
      console.log(`     - ${price.serviceType?.name || 'Sin servicio'}: $${price.basePrice}`);
    });
  });
}

// Ejecutar el script
testNewQueryRates(); 