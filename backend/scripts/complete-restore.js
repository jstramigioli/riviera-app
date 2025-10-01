const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function completeRestore() {
  try {
    console.log('🔄 Completando restauración...');

    // 1. Crear habitaciones básicas
    console.log('🏠 Creando habitaciones...');
    const rooms = [
      { name: 'Habitación 1', roomTypeId: 1, maxPeople: 1, status: 'disponible', orderIndex: 1 },
      { name: 'Habitación 2', roomTypeId: 2, maxPeople: 2, status: 'disponible', orderIndex: 2 },
      { name: 'Habitación 3', roomTypeId: 3, maxPeople: 3, status: 'disponible', orderIndex: 3 },
      { name: 'Habitación 4', roomTypeId: 4, maxPeople: 4, status: 'disponible', orderIndex: 4 }
    ];
    
    for (const room of rooms) {
      await prisma.room.create({
        data: room
      });
    }
    console.log('✅ Habitaciones creadas');

    // 2. Crear tipos de servicio básicos
    console.log('🍽️ Creando tipos de servicio...');
    const serviceTypes = [
      { id: 'base-service', hotelId: 'default-hotel', name: 'Tarifa base', description: 'Tarifa base sin servicios adicionales', isActive: true, orderIndex: 1 },
      { id: 'breakfast-service', hotelId: 'default-hotel', name: 'Desayuno', description: 'Incluye desayuno', isActive: true, orderIndex: 2 },
      { id: 'half-board-service', hotelId: 'default-hotel', name: 'Media Pensión', description: 'Incluye desayuno y cena', isActive: true, orderIndex: 3 }
    ];
    
    for (const serviceType of serviceTypes) {
      await prisma.serviceType.create({
        data: serviceType
      });
    }
    console.log('✅ Tipos de servicio creados');

    // 3. Crear configuración de precios dinámicos
    console.log('⚙️ Creando configuración de precios dinámicos...');
    await prisma.dynamicPricingConfig.create({
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
        maxAdjustmentPercentage: 50,
        enableGapPromos: true,
        enableWeatherApi: false,
        enableRecentDemand: false,
        anticipationMode: 'ESCALONADO',
        anticipationMaxDays: 30,
        standardRate: 100,
        idealOccupancy: 80,
        occupancyAdjustmentPercentage: 20,
        anticipationAdjustmentPercentage: 15,
        weekendAdjustmentPercentage: 10,
        holidayAdjustmentPercentage: 25,
        occupancyEnabled: true,
        anticipationEnabled: true,
        weekendEnabled: true,
        holidayEnabled: true
      }
    });
    console.log('✅ Configuración de precios dinámicos creada');

    // 4. Crear configuración de redondeo
    console.log('🔢 Creando configuración de redondeo...');
    await prisma.roundingConfig.create({
      data: {
        hotelId: 'default-hotel',
        multiple: 1,
        mode: 'nearest'
      }
    });
    console.log('✅ Configuración de redondeo creada');

    // 5. Crear algunos clientes de prueba
    console.log('👥 Creando clientes de prueba...');
    const clients = [
      {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        phone: '+54 11 1234-5678',
        country: 'Argentina',
        province: 'Buenos Aires',
        city: 'Buenos Aires',
        documentType: 'DNI',
        documentNumber: '12345678',
        esFicticio: false
      },
      {
        firstName: 'María',
        lastName: 'González',
        email: 'maria.gonzalez@email.com',
        phone: '+54 11 8765-4321',
        country: 'Argentina',
        province: 'Buenos Aires',
        city: 'Buenos Aires',
        documentType: 'DNI',
        documentNumber: '87654321',
        esFicticio: false
      },
      {
        firstName: 'Carlos',
        lastName: 'López',
        email: 'carlos.lopez@email.com',
        phone: '+54 11 5555-5555',
        country: 'Argentina',
        province: 'Buenos Aires',
        city: 'Buenos Aires',
        documentType: 'DNI',
        documentNumber: '55555555',
        esFicticio: false
      }
    ];
    
    for (const client of clients) {
      await prisma.client.create({
        data: client
      });
    }
    console.log('✅ Clientes de prueba creados');

    console.log('🎉 Restauración completada!');
    
    // Verificar datos restaurados
    const finalCounts = await Promise.all([
      prisma.hotel.count(),
      prisma.client.count(),
      prisma.room.count(),
      prisma.roomType.count(),
      prisma.serviceType.count(),
      prisma.dynamicPricingConfig.count(),
      prisma.roundingConfig.count()
    ]);
    
    console.log('📊 Datos restaurados:');
    console.log(`🏨 Hoteles: ${finalCounts[0]}`);
    console.log(`👥 Clientes: ${finalCounts[1]}`);
    console.log(`🏠 Habitaciones: ${finalCounts[2]}`);
    console.log(`🛏️ Tipos de habitación: ${finalCounts[3]}`);
    console.log(`🍽️ Tipos de servicio: ${finalCounts[4]}`);
    console.log(`⚙️ Configuración de precios: ${finalCounts[5]}`);
    console.log(`🔢 Configuración de redondeo: ${finalCounts[6]}`);

  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

completeRestore();
