const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkServiceAdjustments() {
  console.log('🔍 Verificando ajustes de porcentaje de servicios...\n');

  try {
    // Obtener el bloque activo con sus ajustes de servicio
    const seasonBlock = await prisma.seasonBlock.findFirst({
      where: {
        hotelId: 'default-hotel',
        isDraft: false
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

    if (seasonBlock) {
      console.log(`📊 Bloque: ${seasonBlock.name}`);
      
      console.log('\n🎛️ Ajustes de porcentaje configurados:');
      seasonBlock.blockServiceSelections.forEach(selection => {
        const adjustment = selection.percentageAdjustment || 0;
        console.log(`  - ${selection.serviceType.name}: ${adjustment}%`);
      });

      console.log('\n💰 Precios base (sin ajustes):');
      const pricesByRoomType = {};
      seasonBlock.seasonPrices.forEach(price => {
        const roomTypeName = price.roomType.name;
        if (!pricesByRoomType[roomTypeName]) {
          pricesByRoomType[roomTypeName] = [];
        }
        pricesByRoomType[roomTypeName].push({
          service: price.serviceType.name,
          basePrice: price.basePrice
        });
      });

      Object.keys(pricesByRoomType).forEach(roomType => {
        console.log(`\n  🏠 ${roomType}:`);
        pricesByRoomType[roomType].forEach(priceInfo => {
          // Buscar el ajuste para este servicio
          const adjustment = seasonBlock.blockServiceSelections.find(
            sel => sel.serviceType.name === priceInfo.service
          )?.percentageAdjustment || 0;
          
          const adjustedPrice = priceInfo.basePrice * (1 + adjustment / 100);
          
          console.log(`    - ${priceInfo.service}: $${priceInfo.basePrice} base + ${adjustment}% = $${Math.round(adjustedPrice)}`);
        });
      });
    }

    console.log('\n✅ Verificación completada');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkServiceAdjustments(); 