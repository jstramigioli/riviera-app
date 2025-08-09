const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNewTariffSystem() {
  try {
    console.log('🧪 Probando nuevo sistema de tarifas...\n');

    // 1. Crear hotel de prueba
    console.log('1. Creando hotel de prueba...');
    const hotel = await prisma.hotel.upsert({
      where: { id: 'test-hotel' },
      update: {},
      create: {
        id: 'test-hotel',
        name: 'Hotel de Prueba',
        description: 'Hotel para pruebas del nuevo sistema de tarifas'
      }
    });
    console.log('✅ Hotel creado:', hotel.name);

    // 2. Crear tipos de habitación de prueba
    console.log('\n2. Creando tipos de habitación...');
    const roomTypes = await Promise.all([
      prisma.roomType.upsert({
        where: { name: 'Individual' },
        update: {},
        create: {
          name: 'Individual',
          description: 'Habitación individual',
          multiplier: 1.0,
          orderIndex: 1
        }
      }),
      prisma.roomType.upsert({
        where: { name: 'Doble' },
        update: {},
        create: {
          name: 'Doble',
          description: 'Habitación doble',
          multiplier: 1.5,
          orderIndex: 2
        }
      }),
      prisma.roomType.upsert({
        where: { name: 'Suite' },
        update: {},
        create: {
          name: 'Suite',
          description: 'Suite de lujo',
          multiplier: 2.5,
          orderIndex: 3
        }
      })
    ]);
    console.log('✅ Tipos de habitación creados:', roomTypes.map(rt => rt.name));

    // 3. Crear bloques de temporada
    console.log('\n3. Creando bloques de temporada...');
    const seasonBlocks = await Promise.all([
      prisma.seasonBlock.create({
        data: {
          hotelId: hotel.id,
          name: 'Temporada Baja',
          description: 'Temporada de menor demanda',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-08-31'),
          orderIndex: 1
        }
      }),
      prisma.seasonBlock.create({
        data: {
          hotelId: hotel.id,
          name: 'Temporada Media',
          description: 'Temporada de demanda media',
          startDate: new Date('2024-04-01'),
          endDate: new Date('2024-05-31'),
          orderIndex: 2
        }
      }),
      prisma.seasonBlock.create({
        data: {
          hotelId: hotel.id,
          name: 'Temporada Alta',
          description: 'Temporada de mayor demanda',
          startDate: new Date('2024-12-01'),
          endDate: new Date('2025-03-31'),
          orderIndex: 3
        }
      })
    ]);
    console.log('✅ Bloques de temporada creados:', seasonBlocks.map(sb => sb.name));

    // 4. Crear precios base por temporada
    console.log('\n4. Creando precios base por temporada...');
    const seasonPrices = [];
    
    for (const block of seasonBlocks) {
      for (const roomType of roomTypes) {
        let basePrice;
        switch (block.name) {
          case 'Temporada Baja':
            basePrice = roomType.multiplier * 50000; // $500 base
            break;
          case 'Temporada Media':
            basePrice = roomType.multiplier * 70000; // $700 base
            break;
          case 'Temporada Alta':
            basePrice = roomType.multiplier * 100000; // $1000 base
            break;
        }
        
        const seasonPrice = await prisma.seasonPrice.create({
          data: {
            seasonBlockId: block.id,
            roomTypeId: roomType.id,
            basePrice
          }
        });
        seasonPrices.push(seasonPrice);
      }
    }
    console.log('✅ Precios base creados:', seasonPrices.length, 'registros');

    // 5. Crear tipos de servicio
    console.log('\n5. Creando tipos de servicio...');
    const serviceTypes = await Promise.all([
      prisma.serviceType.create({
        data: {
          hotelId: hotel.id,
          name: 'Solo Alojamiento',
          description: 'Solo la habitación sin servicios adicionales',
          orderIndex: 1
        }
      }),
      prisma.serviceType.create({
        data: {
          hotelId: hotel.id,
          name: 'Con Desayuno',
          description: 'Habitación con desayuno incluido',
          orderIndex: 2
        }
      }),
      prisma.serviceType.create({
        data: {
          hotelId: hotel.id,
          name: 'Media Pensión',
          description: 'Habitación con desayuno y cena',
          orderIndex: 3
        }
      })
    ]);
    console.log('✅ Tipos de servicio creados:', serviceTypes.map(st => st.name));

    // 6. Crear ajustes por servicio
    console.log('\n6. Creando ajustes por servicio...');
    const serviceAdjustments = [];
    
    for (const serviceType of serviceTypes) {
      for (const roomType of roomTypes) {
        let adjustment;
        
        switch (serviceType.name) {
          case 'Solo Alojamiento':
            adjustment = { mode: 'FIXED', value: 0, isPermanent: true };
            break;
          case 'Con Desayuno':
            adjustment = { mode: 'PERCENTAGE', value: 15, isPermanent: true };
            break;
          case 'Media Pensión':
            adjustment = { mode: 'PERCENTAGE', value: 35, isPermanent: true };
            break;
        }
        
        const serviceAdjustment = await prisma.serviceAdjustment.create({
          data: {
            serviceTypeId: serviceType.id,
            roomTypeId: roomType.id,
            ...adjustment
          }
        });
        serviceAdjustments.push(serviceAdjustment);
      }
    }
    console.log('✅ Ajustes por servicio creados:', serviceAdjustments.length, 'registros');

    // 7. Verificar la estructura creada
    console.log('\n7. Verificando estructura creada...');
    
    const hotelWithData = await prisma.hotel.findUnique({
      where: { id: hotel.id },
      include: {
        seasonBlocks: {
          include: {
            seasonPrices: {
              include: {
                roomType: true
              }
            }
          }
        },
        serviceTypes: {
          include: {
            serviceAdjustments: {
              include: {
                roomType: true
              }
            }
          }
        }
      }
    });

    console.log('\n📊 RESUMEN DE LA ESTRUCTURA CREADA:');
    console.log('Hotel:', hotelWithData.name);
    console.log('Bloques de temporada:', hotelWithData.seasonBlocks.length);
    console.log('Tipos de servicio:', hotelWithData.serviceTypes.length);
    
    console.log('\n📋 BLOQUES DE TEMPORADA:');
    for (const block of hotelWithData.seasonBlocks) {
      console.log(`- ${block.name} (${block.startDate.toLocaleDateString()} - ${block.endDate.toLocaleDateString()})`);
      console.log('  Precios base:');
      for (const price of block.seasonPrices) {
        console.log(`    ${price.roomType.name}: $${price.basePrice.toLocaleString()}`);
      }
    }
    
    console.log('\n📋 TIPOS DE SERVICIO:');
    for (const service of hotelWithData.serviceTypes) {
      console.log(`- ${service.name}`);
      console.log('  Ajustes por tipo de habitación:');
      for (const adjustment of service.serviceAdjustments) {
        const modeText = adjustment.mode === 'FIXED' ? 'fijo' : 'porcentaje';
        const valueText = adjustment.mode === 'FIXED' ? `$${adjustment.value}` : `${adjustment.value}%`;
        console.log(`    ${adjustment.roomType.name}: ${valueText} (${modeText})`);
      }
    }

    console.log('\n✅ ¡Sistema de tarifas probado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la prueba
testNewTariffSystem(); 