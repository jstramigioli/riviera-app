const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkActiveBlocks() {
  try {
    console.log('🔍 Verificando bloques de temporada activos...\n');

    // Obtener todos los bloques de temporada
    const allBlocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId: 'default-hotel'
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
      orderBy: [
        { startDate: 'asc' },
        { isDraft: 'asc' }
      ]
    });

    console.log(`📊 Total de bloques encontrados: ${allBlocks.length}\n`);

    if (allBlocks.length === 0) {
      console.log('❌ No hay bloques de temporada configurados');
      return;
    }

    // Mostrar información de cada bloque
    allBlocks.forEach((block, index) => {
      console.log(`📅 Bloque ${index + 1}: ${block.name}`);
      console.log(`   ID: ${block.id}`);
      console.log(`   Estado: ${block.isDraft ? '🟡 BORRADOR' : '🟢 CONFIRMADO'}`);
      console.log(`   Fechas: ${block.startDate.toISOString().split('T')[0]} - ${block.endDate.toISOString().split('T')[0]}`);
      console.log(`   Precios configurados: ${block.seasonPrices.length}`);
      console.log(`   Servicios configurados: ${block.blockServiceSelections.length}`);
      console.log(`   Última modificación: ${block.lastSavedAt ? block.lastSavedAt.toISOString() : 'Nunca'}`);
      console.log('');
    });

    // Verificar bloques confirmados
    const confirmedBlocks = allBlocks.filter(block => !block.isDraft);
    console.log(`✅ Bloques confirmados: ${confirmedBlocks.length}`);
    
    if (confirmedBlocks.length > 0) {
      console.log('📋 Bloques confirmados:');
      confirmedBlocks.forEach(block => {
        console.log(`   - ${block.name} (${block.startDate.toISOString().split('T')[0]} - ${block.endDate.toISOString().split('T')[0]})`);
      });
    }

    // Verificar bloques en borrador
    const draftBlocks = allBlocks.filter(block => block.isDraft);
    console.log(`\n🟡 Bloques en borrador: ${draftBlocks.length}`);
    
    if (draftBlocks.length > 0) {
      console.log('📋 Bloques en borrador:');
      draftBlocks.forEach(block => {
        console.log(`   - ${block.name} (${block.startDate.toISOString().split('T')[0]} - ${block.endDate.toISOString().split('T')[0]})`);
      });
    }

    // Verificar solapamientos
    console.log('\n🔍 Verificando solapamientos de fechas...');
    const today = new Date();
    const overlappingBlocks = allBlocks.filter(block => 
      block.startDate <= today && block.endDate >= today
    );

    console.log(`📅 Bloques que cubren la fecha actual (${today.toISOString().split('T')[0]}): ${overlappingBlocks.length}`);
    
    if (overlappingBlocks.length > 0) {
      overlappingBlocks.forEach(block => {
        console.log(`   - ${block.name} (${block.isDraft ? 'BORRADOR' : 'CONFIRMADO'})`);
      });
    }

    // Verificar qué bloque sería el activo para hoy
    const activeBlockForToday = overlappingBlocks.find(block => !block.isDraft);
    if (activeBlockForToday) {
      console.log(`\n✅ Bloque activo para hoy: ${activeBlockForToday.name}`);
      console.log(`   Precios base configurados:`);
      activeBlockForToday.seasonPrices.forEach(price => {
        console.log(`     - ${price.roomType.name}: $${price.basePrice}`);
      });
    } else if (overlappingBlocks.length > 0) {
      console.log(`\n⚠️  Solo hay bloques en borrador para hoy. El bloque activo sería: ${overlappingBlocks[0].name}`);
    } else {
      console.log(`\n❌ No hay bloques que cubran la fecha actual`);
    }

  } catch (error) {
    console.error('❌ Error al verificar bloques:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
checkActiveBlocks(); 