const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function basicRestore() {
  try {
    console.log('🔄 Restauración básica desde backup...');
    
    // Usar el backup más reciente
    const backupPath = path.join(__dirname, '../backups/backup_2025-09-02T22-59-43-571Z');
    
    if (!fs.existsSync(backupPath)) {
      console.error('❌ No se encontró el directorio de backup');
      return;
    }

    // 1. Crear hotel básico
    console.log('🏨 Creando hotel básico...');
    await prisma.hotel.create({
      data: {
        id: 'default-hotel',
        name: 'Hotel Riviera',
        description: 'Hotel por defecto',
        isActive: true
      }
    });
    console.log('✅ Hotel creado');

    // 2. Crear tipos de habitación básicos
    console.log('🛏️ Creando tipos de habitación...');
    const roomTypes = [
      { name: 'Single', description: 'Habitación individual', orderIndex: 1 },
      { name: 'Doble', description: 'Habitación doble', orderIndex: 2 },
      { name: 'Triple', description: 'Habitación triple', orderIndex: 3 },
      { name: 'Cuádruple', description: 'Habitación cuádruple', orderIndex: 4 }
    ];
    
    for (const roomType of roomTypes) {
      await prisma.roomType.create({
        data: roomType
      });
    }
    console.log('✅ Tipos de habitación creados');

    // 3. Crear habitaciones básicas
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

    // 4. Crear tipos de servicio básicos
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

    // 5. Crear configuración de precios dinámicos
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

    // 6. Crear configuración de redondeo
    console.log('🔢 Creando configuración de redondeo...');
    await prisma.roundingConfig.create({
      data: {
        hotelId: 'default-hotel',
        multiple: 1,
        mode: 'nearest'
      }
    });
    console.log('✅ Configuración de redondeo creada');

    // 7. Crear algunos clientes de prueba
    console.log('👥 Creando clientes de prueba...');
    const clients = [
      {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        phone: '+54 11 1234-5678',
        address: 'Av. Corrientes 1234',
        city: 'Buenos Aires',
        documentType: 'DNI',
        documentNumber: '12345678',
        isFicticio: false
      },
      {
        firstName: 'María',
        lastName: 'González',
        email: 'maria.gonzalez@email.com',
        phone: '+54 11 8765-4321',
        address: 'Av. Santa Fe 5678',
        city: 'Buenos Aires',
        documentType: 'DNI',
        documentNumber: '87654321',
        isFicticio: false
      },
      {
        firstName: 'Carlos',
        lastName: 'López',
        email: 'carlos.lopez@email.com',
        phone: '+54 11 5555-5555',
        address: 'Av. Rivadavia 9999',
        city: 'Buenos Aires',
        documentType: 'DNI',
        documentNumber: '55555555',
        isFicticio: false
      }
    ];
    
    for (const client of clients) {
      await prisma.client.create({
        data: client
      });
    }
    console.log('✅ Clientes de prueba creados');

    console.log('🎉 Restauración básica completada!');
    
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

basicRestore();
