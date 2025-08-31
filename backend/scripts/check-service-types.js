const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkServiceTypes() {
  console.log('🔍 Verificando tipos de servicios configurados...\n');

  try {
    // Obtener todos los tipos de servicios
    const serviceTypes = await prisma.serviceType.findMany({
      where: {
        hotelId: 'default-hotel'
      },
      orderBy: {
        orderIndex: 'asc'
      }
    });

    console.log('📋 Tipos de servicios disponibles:');
    serviceTypes.forEach((service, index) => {
      console.log(`  ${index + 1}. ${service.name} (ID: ${service.id})`);
      if (service.description) {
        console.log(`     Descripción: ${service.description}`);
      }
    });

    // Verificar precios de ejemplo para un bloque específico
    console.log('\n💰 Verificando precios de ejemplo:');
    const seasonBlock = await prisma.seasonBlock.findFirst({
      where: {
        hotelId: 'default-hotel',
        isDraft: false
      },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        }
      }
    });

    if (seasonBlock) {
      console.log(`\n📊 Precios en bloque: ${seasonBlock.name}`);
      
      // Agrupar por tipo de habitación
      const pricesByRoomType = {};
      seasonBlock.seasonPrices.forEach(price => {
        const roomTypeName = price.roomType.name;
        if (!pricesByRoomType[roomTypeName]) {
          pricesByRoomType[roomTypeName] = [];
        }
        pricesByRoomType[roomTypeName].push({
          service: price.serviceType.name,
          price: price.basePrice
        });
      });

      Object.keys(pricesByRoomType).forEach(roomType => {
        console.log(`\n  🏠 ${roomType}:`);
        pricesByRoomType[roomType].forEach(priceInfo => {
          console.log(`    - ${priceInfo.service}: $${priceInfo.price}`);
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

checkServiceTypes(); 