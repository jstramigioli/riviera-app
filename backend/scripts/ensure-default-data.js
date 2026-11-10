const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function ensureDefaultData() {
  try {
    console.log('🔍 Verificando datos por defecto...');
    
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

    // Verificar tipos de habitación por defecto
    const roomTypes = await prisma.roomType.findMany();
    if (roomTypes.length === 0) {
      console.log('🛏️ Creando tipos de habitación por defecto...');
      await prisma.roomType.createMany({
        data: [
          { name: 'Single', description: 'Habitación individual', orderIndex: 1 },
          { name: 'Doble', description: 'Habitación doble', orderIndex: 2 },
          { name: 'Triple', description: 'Habitación triple', orderIndex: 3 }
        ]
      });
      console.log('✅ Tipos de habitación creados');
    } else {
      console.log('✅ Tipos de habitación encontrados:', roomTypes.length);
    }

    // Verificar tipos de servicio por defecto
    const serviceTypes = await prisma.serviceType.findMany({
      where: { hotelId: 'default-hotel' }
    });
    
    if (serviceTypes.length === 0) {
      console.log('🍽️ Creando tipos de servicio por defecto...');
      await prisma.serviceType.createMany({
        data: [
          { 
            hotelId: 'default-hotel',
            name: 'Solo Alojamiento', 
            description: 'Tarifa base sin servicios adicionales',
            orderIndex: 1 
          },
          { 
            hotelId: 'default-hotel',
            name: 'Desayuno', 
            description: 'Incluye desayuno',
            orderIndex: 2 
          },
          { 
            hotelId: 'default-hotel',
            name: 'Media Pensión', 
            description: 'Incluye desayuno y cena',
            orderIndex: 3 
          },
          { 
            hotelId: 'default-hotel',
            name: 'Pensión Completa', 
            description: 'Incluye desayuno, almuerzo y cena',
            orderIndex: 4 
          }
        ]
      });
      console.log('✅ Tipos de servicio creados');
    } else {
      console.log('✅ Tipos de servicio encontrados:', serviceTypes.length);
    }

    // Verificar configuración de dynamic pricing
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

ensureDefaultData(); 