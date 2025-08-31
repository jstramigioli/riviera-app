const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugQueryRates() {
  try {
    console.log('🔍 Debuggeando tarifas de nueva consulta...\n');

    // Simular diferentes fechas que podrían estar usando
    const testDates = [
      new Date().toISOString().split('T')[0], // Fecha actual
      '2025-08-30', // Fecha específica
      '2025-08-25', // Fecha anterior
      '2025-08-15'  // Fecha anterior
    ];

    for (const testDate of testDates) {
      console.log(`\n📅 Probando fecha: ${testDate}`);
      
      const targetDate = new Date(testDate);
      
      // Simular exactamente la lógica del endpoint /api/season-blocks/active
      const seasonBlocks = await prisma.seasonBlock.findMany({
        where: {
          hotelId: 'default-hotel',
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

      console.log(`   📊 Bloques encontrados: ${seasonBlocks.length}`);

      if (seasonBlocks.length === 0) {
        console.log(`   ❌ No hay bloques para esta fecha`);
        continue;
      }

      // Mostrar todos los bloques encontrados
      seasonBlocks.forEach((block, index) => {
        console.log(`   ${index + 1}. ${block.name} (${block.isDraft ? 'BORRADOR' : 'CONFIRMADO'})`);
        console.log(`      Fechas: ${block.startDate.toISOString().split('T')[0]} - ${block.endDate.toISOString().split('T')[0]}`);
      });

      // Buscar el primer bloque confirmado (no borrador)
      const activeBlock = seasonBlocks.find(block => !block.isDraft);
      
      if (!activeBlock) {
        console.log(`   ⚠️  No hay bloques confirmados para esta fecha`);
        
        // Solo hay borradores
        const draftBlocks = seasonBlocks.filter(block => block.isDraft);
        if (draftBlocks.length > 0) {
          console.log(`   📋 Bloques en borrador disponibles:`);
          draftBlocks.forEach(block => {
            console.log(`      - ${block.name} (ID: ${block.id})`);
          });
        }
      } else {
        console.log(`   ✅ Bloque activo: ${activeBlock.name}`);
        
        // Mostrar precios para single
        const singlePrices = activeBlock.seasonPrices.filter(price => price.roomType.name === 'single');
        console.log(`   💰 Precios para single:`);
        singlePrices.forEach(price => {
          console.log(`      - ${price.serviceType?.name || 'Sin servicio'}: $${price.basePrice}`);
        });
        
        // Calcular tarifas como lo hace la nueva consulta
        const basePrice = singlePrices.length > 0 ? singlePrices[0].basePrice : 50000;
        const withBreakfast = Math.round(basePrice * 1.15);
        const withHalfBoard = Math.round(basePrice * 1.35);
        
        console.log(`   📊 Tarifas calculadas:`);
        console.log(`      - Base: $${basePrice}`);
        console.log(`      - Con desayuno: $${withBreakfast}`);
        console.log(`      - Media pensión: $${withHalfBoard}`);
      }
    }

    // También verificar si hay algún problema con la habitación 31 específicamente
    console.log('\n🏠 Verificando habitación 31...');
    const room31 = await prisma.room.findUnique({
      where: { id: 31 },
      include: {
        roomType: true
      }
    });

    if (room31) {
      console.log(`   Habitación 31: ${room31.name} (${room31.roomType.name})`);
      
      // Verificar precios para este tipo de habitación en todos los bloques
      const allBlocks = await prisma.seasonBlock.findMany({
        where: { hotelId: 'default-hotel' },
        include: {
          seasonPrices: {
            where: { roomTypeId: room31.roomType.id },
            include: {
              roomType: true,
              serviceType: true
            }
          }
        }
      });

      console.log(`   📋 Precios para ${room31.roomType.name} en todos los bloques:`);
      allBlocks.forEach(block => {
        console.log(`      ${block.name} (${block.isDraft ? 'BORRADOR' : 'CONFIRMADO'}):`);
        block.seasonPrices.forEach(price => {
          console.log(`        - ${price.serviceType?.name || 'Sin servicio'}: $${price.basePrice}`);
        });
      });
    } else {
      console.log(`   ❌ Habitación 31 no encontrada`);
    }

  } catch (error) {
    console.error('❌ Error al debuggear tarifas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
debugQueryRates(); 