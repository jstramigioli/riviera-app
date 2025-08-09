const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createDefaultHotel() {
  try {
    console.log('🏨 Creando hotel por defecto...');
    
    // Crear hotel por defecto
    const defaultHotel = await prisma.hotel.create({
      data: {
        id: 'default-hotel',
        name: 'Hotel Riviera',
        description: 'Hotel por defecto',
        isActive: true
      }
    });
    
    console.log('✅ Hotel creado:', defaultHotel);
    
    // Actualizar registros existentes de OpenDay
    console.log('📅 Actualizando registros de OpenDay...');
    const updatedOpenDays = await prisma.openDay.updateMany({
      where: {
        hotelId: null
      },
      data: {
        hotelId: 'default-hotel'
      }
    });
    
    console.log(`✅ ${updatedOpenDays.count} registros de OpenDay actualizados`);
    
    // Actualizar otros registros que usen hotelId
    console.log('🔄 Actualizando otros registros...');
    
    // DynamicPricingConfig
    await prisma.dynamicPricingConfig.updateMany({
      where: {
        hotelId: null
      },
      data: {
        hotelId: 'default-hotel'
      }
    });
    
    // SeasonalKeyframe
    await prisma.seasonalKeyframe.updateMany({
      where: {
        hotelId: null
      },
      data: {
        hotelId: 'default-hotel'
      }
    });
    
    // DailyRoomRate
    await prisma.dailyRoomRate.updateMany({
      where: {
        hotelId: null
      },
      data: {
        hotelId: 'default-hotel'
      }
    });
    
    // MealPricingRule
    await prisma.mealPricingRule.updateMany({
      where: {
        hotelId: null
      },
      data: {
        hotelId: 'default-hotel'
      }
    });
    
    console.log('✅ Todos los registros actualizados correctamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultHotel(); 