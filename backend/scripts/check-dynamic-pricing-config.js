const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAndCreateDynamicPricingConfig() {
  try {
    console.log('🔍 Verificando configuración de dynamic pricing...');
    
    // Verificar si existe el hotel por defecto
    let hotel = await prisma.hotel.findUnique({
      where: { id: 'default-hotel' }
    });

    if (!hotel) {
      console.log('🏨 Creando hotel por defecto...');
      hotel = await prisma.hotel.create({
        data: {
          id: 'default-hotel',
          name: 'Hotel Riviera',
          description: 'Hotel por defecto',
          isActive: true
        }
      });
      console.log('✅ Hotel creado:', hotel.id);
    } else {
      console.log('✅ Hotel encontrado:', hotel.id);
    }

    // Verificar si existe la configuración de dynamic pricing
    let dynamicPricingConfig = await prisma.dynamicPricingConfig.findUnique({
      where: { hotelId: 'default-hotel' }
    });

    if (!dynamicPricingConfig) {
      console.log('⚙️ Creando configuración de dynamic pricing...');
      dynamicPricingConfig = await prisma.dynamicPricingConfig.create({
        data: {
          hotelId: 'default-hotel',
          enabled: false,
          anticipationThresholds: [7, 14, 30],
          anticipationWeight: 0.3,
          globalOccupancyWeight: 0.2,
          isWeekendWeight: 0.15,
          weekendDays: [0, 6],
          isHolidayWeight: 0.2,
          weatherScoreWeight: 0.1,
          eventImpactWeight: 0.05,
          maxAdjustmentPercentage: 50.0,
          enableGapPromos: true,
          enableWeatherApi: false,
          enableRecentDemand: false,
          anticipationMode: 'ESCALONADO',
          anticipationMaxDays: 30,
          standardRate: 100.0,
          idealOccupancy: 80.0,
          occupancyAdjustmentPercentage: 20.0,
          anticipationAdjustmentPercentage: 15.0,
          weekendAdjustmentPercentage: 10.0,
          holidayAdjustmentPercentage: 25.0,
          occupancyEnabled: true,
          anticipationEnabled: true,
          weekendEnabled: true,
          holidayEnabled: true
        }
      });
      console.log('✅ Configuración de dynamic pricing creada');
    } else {
      console.log('✅ Configuración de dynamic pricing encontrada');
    }

    console.log('🎉 Verificación completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCreateDynamicPricingConfig(); 