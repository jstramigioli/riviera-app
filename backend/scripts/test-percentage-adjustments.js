const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPercentageAdjustments() {
  console.log('🧪 Probando ajustes de porcentaje...\n');

  try {
    // Obtener el bloque activo
    const seasonBlock = await prisma.seasonBlock.findFirst({
      where: {
        hotelId: 'default-hotel'
      },
      include: {
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        },
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        }
      }
    });

    if (!seasonBlock) {
      console.log('❌ No se encontró un bloque activo');
      return;
    }

    console.log(`📊 Bloque: ${seasonBlock.name}`);
    
    // Mostrar ajustes actuales
    console.log('\n🎛️ Ajustes de porcentaje actuales:');
    seasonBlock.blockServiceSelections.forEach(selection => {
      const adjustment = selection.percentageAdjustment || 0;
      console.log(`  - ${selection.serviceType.name}: ${adjustment}%`);
    });

    // Simular aplicación de ajustes
    console.log('\n💰 Cálculo de tarifas con ajustes:');
    const roomType = 'single';
    const roomTypePrices = seasonBlock.seasonPrices.filter(
      price => price.roomType.name === roomType
    );

    roomTypePrices.forEach(price => {
      const serviceName = price.serviceType.name;
      const basePrice = price.basePrice;
      
      // Buscar ajuste para este servicio
      const adjustment = seasonBlock.blockServiceSelections.find(
        sel => sel.serviceType.name === serviceName
      )?.percentageAdjustment || 0;
      
      const adjustedPrice = basePrice * (1 + adjustment / 100);
      
      console.log(`  - ${serviceName}: $${basePrice} base + ${adjustment}% = $${Math.round(adjustedPrice)}`);
    });

    console.log('\n✅ Prueba completada');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPercentageAdjustments(); 