const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedBlockServiceSelection() {
  console.log('🚀 Iniciando seed de BlockServiceSelection...');

  try {
    // 1. Crear servicios globales básicos
    console.log('📊 Creando servicios globales...');
    let hotel = await prisma.hotel.findFirst();
    
    if (!hotel) {
      console.log('❌ No se encontró hotel. Creando uno por defecto...');
      const defaultHotel = await prisma.hotel.create({
        data: {
          name: 'Hotel Riviera',
          description: 'Hotel por defecto'
        }
      });
      hotel = defaultHotel;
    }

    // Crear tipos de servicio básicos
    const serviceTypes = [
      { name: 'Solo Alojamiento', description: 'Tarifa base sin servicios adicionales', orderIndex: 0 },
      { name: 'Con Desayuno', description: 'Incluye desayuno continental', orderIndex: 1 },
      { name: 'Media Pensión', description: 'Incluye desayuno y cena', orderIndex: 2 },
      { name: 'Pensión Completa', description: 'Incluye desayuno, almuerzo y cena', orderIndex: 3 }
    ];

    for (const serviceData of serviceTypes) {
      await prisma.serviceType.upsert({
        where: {
          hotelId_name: {
            hotelId: hotel.id,
            name: serviceData.name
          }
        },
        update: {},
        create: {
          hotelId: hotel.id,
          name: serviceData.name,
          description: serviceData.description,
          orderIndex: serviceData.orderIndex
        }
      });
    }

    console.log('✅ Servicios globales creados');

    // 2. Crear tipos de habitación básicos
    console.log('📊 Creando tipos de habitación...');
    const roomTypes = [
      { name: 'Doble', description: 'Habitación doble', orderIndex: 0 },
      { name: 'Triple', description: 'Habitación triple', orderIndex: 1 },
      { name: 'Suite', description: 'Suite de lujo', orderIndex: 2 }
    ];

    for (const roomData of roomTypes) {
      await prisma.roomType.upsert({
        where: {
          name: roomData.name
        },
        update: {},
        create: {
          name: roomData.name,
          description: roomData.description,
          orderIndex: roomData.orderIndex
        }
      });
    }

    console.log('✅ Tipos de habitación creados');

    // 3. Crear un bloque de temporada de ejemplo
    console.log('📊 Creando bloque de temporada de ejemplo...');
    const seasonBlock = await prisma.seasonBlock.upsert({
      where: {
        hotelId_name: {
          hotelId: hotel.id,
          name: 'Temporada Alta'
        }
      },
      update: {},
      create: {
        hotelId: hotel.id,
        name: 'Temporada Alta',
        description: 'Temporada alta de verano',
        startDate: new Date('2024-12-01'),
        endDate: new Date('2024-12-31'),
        useProportions: false
      }
    });

    console.log('✅ Bloque de temporada creado');

    // 4. Crear selecciones de servicios para el bloque
    console.log('📊 Creando selecciones de servicios...');
    const serviceTypesList = await prisma.serviceType.findMany({
      where: { hotelId: hotel.id },
      orderBy: { orderIndex: 'asc' }
    });

    for (const serviceType of serviceTypesList) {
      await prisma.blockServiceSelection.upsert({
        where: {
          seasonBlockId_serviceTypeId: {
            seasonBlockId: seasonBlock.id,
            serviceTypeId: serviceType.id
          }
        },
        update: {},
        create: {
          seasonBlockId: seasonBlock.id,
          serviceTypeId: serviceType.id,
          isEnabled: true,
          pricingMode: serviceType.name === 'Solo Alojamiento' ? 'FIXED' : 'PERCENTAGE',
          fixedPrice: serviceType.name === 'Solo Alojamiento' ? 100 : null,
          percentage: serviceType.name === 'Solo Alojamiento' ? null : 20,
          orderIndex: serviceType.orderIndex
        }
      });
    }

    console.log('✅ Selecciones de servicios creadas');

    // 5. Crear precios base
    console.log('📊 Creando precios base...');
    const roomTypesList = await prisma.roomType.findMany({
      orderBy: { orderIndex: 'asc' }
    });

    for (const roomType of roomTypesList) {
      for (const serviceType of serviceTypesList) {
        const basePrice = roomType.name === 'Doble' ? 100 : 
                         roomType.name === 'Triple' ? 150 : 200;
        
        await prisma.seasonPrice.create({
          data: {
            seasonBlockId: seasonBlock.id,
            roomTypeId: roomType.id,
            serviceTypeId: serviceType.id,
            basePrice: basePrice
          }
        });
      }
    }

    console.log('✅ Precios base creados');

    console.log('🎉 Seed completado exitosamente');

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar seed
seedBlockServiceSelection()
  .then(() => {
    console.log('🎉 Seed completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error en seed:', error);
    process.exit(1);
  }); 