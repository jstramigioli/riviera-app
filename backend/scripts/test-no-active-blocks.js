const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNoActiveBlocks() {
  try {
    console.log('🧪 Probando comportamiento sin bloques activos...\n');

    // Usar una fecha futura donde no hay bloques configurados
    const testDate = '2025-12-01'; // Fecha futura sin bloques
    const hotelId = 'default-hotel';
    
    console.log(`📅 Fecha de prueba: ${testDate}`);
    console.log(`🏨 Hotel ID: ${hotelId}\n`);

    // Simular la lógica del endpoint /api/season-blocks/active
    console.log('🔍 Buscando bloque activo...');
    
    const targetDate = new Date(testDate);
    
    // Buscar bloques que cubran la fecha
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
      orderBy: { isDraft: 'asc' }
    });

    console.log(`📊 Bloques encontrados para la fecha: ${seasonBlocks.length}`);

    if (seasonBlocks.length === 0) {
      console.log('❌ No hay bloques para esta fecha');
      console.log('✅ Comportamiento esperado: Debería mostrar "Sin tarifas" en la nueva consulta');
      return;
    }

    // Mostrar todos los bloques encontrados
    seasonBlocks.forEach((block, index) => {
      console.log(`   ${index + 1}. ${block.name} (${block.isDraft ? 'BORRADOR' : 'CONFIRMADO'})`);
    });

    // Buscar el primer bloque confirmado
    const activeBlock = seasonBlocks.find(block => !block.isDraft);
    
    if (!activeBlock) {
      console.log('\n⚠️  No hay bloques confirmados para esta fecha');
      console.log('✅ Comportamiento esperado: Debería mostrar "Sin tarifas" en la nueva consulta');
      
      // Mostrar bloques en borrador
      const draftBlocks = seasonBlocks.filter(block => block.isDraft);
      if (draftBlocks.length > 0) {
        console.log(`📋 Bloques en borrador disponibles:`);
        draftBlocks.forEach(block => {
          console.log(`   - ${block.name} (ID: ${block.id})`);
        });
        console.log('ℹ️  Nota: Los bloques en borrador no se usan automáticamente');
      }
    } else {
      console.log(`\n✅ Bloque activo encontrado: ${activeBlock.name}`);
      console.log('✅ Comportamiento esperado: Debería mostrar las tarifas del bloque activo');
    }

    // También probar con una fecha que tenga bloques confirmados para comparar
    console.log('\n🔄 Comparando con fecha que tiene bloques confirmados...');
    const currentDate = new Date().toISOString().split('T')[0];
    console.log(`📅 Fecha actual: ${currentDate}`);
    
    const currentBlocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId,
        startDate: { lte: new Date(currentDate) },
        endDate: { gte: new Date(currentDate) }
      },
      orderBy: { isDraft: 'asc' }
    });

    const currentActiveBlock = currentBlocks.find(block => !block.isDraft);
    if (currentActiveBlock) {
      console.log(`✅ Fecha actual tiene bloque activo: ${currentActiveBlock.name}`);
    } else {
      console.log('⚠️  Fecha actual tampoco tiene bloques confirmados');
    }

  } catch (error) {
    console.error('❌ Error al probar sin bloques activos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
testNoActiveBlocks(); 