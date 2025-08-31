const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSpecificDate() {
  try {
    console.log('🧪 Probando fecha específica...\n');

    // Probar diferentes fechas que podrían estar usando
    const testDates = [
      '2025-08-30', // Fecha actual
      '2025-08-29', // Ayer
      '2025-08-25', // Hace 5 días
      '2025-08-20', // Hace 10 días
      '2025-08-15', // Hace 15 días
      '2025-08-10', // Hace 20 días
      '2025-08-05', // Hace 25 días
      '2025-08-01'  // Hace 29 días
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
      } else {
        console.log(`   ✅ Bloque activo: ${activeBlock.name}`);
        
        // Mostrar precios para single
        const singlePrices = activeBlock.seasonPrices.filter(price => price.roomType.name === 'single');
        if (singlePrices.length > 0) {
          const basePrice = singlePrices[0].basePrice;
          const withBreakfast = Math.round(basePrice * 1.15);
          const withHalfBoard = Math.round(basePrice * 1.35);
          
          console.log(`   💰 Tarifas calculadas:`);
          console.log(`      - Base: $${basePrice}`);
          console.log(`      - Con desayuno: $${withBreakfast}`);
          console.log(`      - Media pensión: $${withHalfBoard}`);
        }
      }
    }

    // También verificar qué fecha está usando el frontend por defecto
    console.log('\n📱 Verificando fecha por defecto del frontend...');
    const defaultDate = new Date().toISOString().split('T')[0];
    console.log(`   Fecha por defecto: ${defaultDate}`);
    
    // Verificar si hay alguna diferencia de zona horaria
    const now = new Date();
    console.log(`   Fecha actual (local): ${now.toLocaleDateString()}`);
    console.log(`   Fecha actual (ISO): ${now.toISOString().split('T')[0]}`);
    console.log(`   Zona horaria: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

  } catch (error) {
    console.error('❌ Error al probar fecha específica:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
testSpecificDate(); 