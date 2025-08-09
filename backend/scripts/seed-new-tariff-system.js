const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedNewTariffSystem() {
  try {
    console.log('🌱 Generando seed para el nuevo sistema de tarifas...\n');

    // Limpiar datos de prueba anteriores
    console.log('🧹 Limpiando datos de prueba anteriores...');
    await prisma.serviceAdjustment.deleteMany({
      where: {
        serviceType: {
          hotelId: 'test-hotel'
        }
      }
    });
    await prisma.serviceType.deleteMany({
      where: { hotelId: 'test-hotel' }
    });
    await prisma.seasonPrice.deleteMany({
      where: {
        seasonBlock: {
          hotelId: 'test-hotel'
        }
      }
    });
    await prisma.seasonBlock.deleteMany({
      where: { hotelId: 'test-hotel' }
    });
    await prisma.hotel.deleteMany({
      where: { id: 'test-hotel' }
    });
    console.log('✅ Datos de prueba limpiados');

    // 1. Crear hotel principal
    console.log('\n1. Creando hotel principal...');
    const hotel = await prisma.hotel.upsert({
      where: { id: 'default-hotel' },
      update: {},
      create: {
        id: 'default-hotel',
        name: 'Hotel Riviera',
        description: 'Hotel principal del sistema',
        address: 'Av. Costanera 123',
        phone: '+54 11 1234-5678',
        email: 'info@hotelriviera.com',
        website: 'https://hotelriviera.com'
      }
    });
    console.log('✅ Hotel creado:', hotel.name);

    // 2. Crear tipos de habitación
    console.log('\n2. Creando tipos de habitación...');
    const roomTypes = await Promise.all([
      prisma.roomType.upsert({
        where: { name: 'Individual' },
        update: {},
        create: {
          name: 'Individual',
          description: 'Habitación individual con baño privado',
          multiplier: 1.0,
          orderIndex: 1
        }
      }),
      prisma.roomType.upsert({
        where: { name: 'Doble' },
        update: {},
        create: {
          name: 'Doble',
          description: 'Habitación doble con baño privado',
          multiplier: 1.5,
          orderIndex: 2
        }
      }),
      prisma.roomType.upsert({
        where: { name: 'Triple' },
        update: {},
        create: {
          name: 'Triple',
          description: 'Habitación triple con baño privado',
          multiplier: 1.8,
          orderIndex: 3
        }
      }),
      prisma.roomType.upsert({
        where: { name: 'Suite' },
        update: {},
        create: {
          name: 'Suite',
          description: 'Suite de lujo con living y baño privado',
          multiplier: 2.5,
          orderIndex: 4
        }
      })
    ]);
    console.log('✅ Tipos de habitación creados:', roomTypes.map(rt => rt.name));

    // 3. Crear bloques de temporada para 2024-2025
    console.log('\n3. Creando bloques de temporada...');
    const seasonBlocks = await Promise.all([
      prisma.seasonBlock.create({
        data: {
          hotelId: hotel.id,
          name: 'Temporada Baja',
          description: 'Temporada de menor demanda (junio-agosto)',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-08-31'),
          orderIndex: 1
        }
      }),
      prisma.seasonBlock.create({
        data: {
          hotelId: hotel.id,
          name: 'Temporada Media',
          description: 'Temporada de demanda media (abril-mayo, septiembre-noviembre)',
          startDate: new Date('2024-04-01'),
          endDate: new Date('2024-05-31'),
          orderIndex: 2
        }
      }),
      prisma.seasonBlock.create({
        data: {
          hotelId: hotel.id,
          name: 'Temporada Alta',
          description: 'Temporada de mayor demanda (diciembre-marzo)',
          startDate: new Date('2024-12-01'),
          endDate: new Date('2025-03-31'),
          orderIndex: 3
        }
      }),
      prisma.seasonBlock.create({
        data: {
          hotelId: hotel.id,
          name: 'Temporada Media 2',
          description: 'Segunda temporada media (septiembre-noviembre)',
          startDate: new Date('2024-09-01'),
          endDate: new Date('2024-11-30'),
          orderIndex: 4
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
            basePrice = roomType.multiplier * 60000; // $600 base
            break;
          case 'Temporada Media':
          case 'Temporada Media 2':
            basePrice = roomType.multiplier * 80000; // $800 base
            break;
          case 'Temporada Alta':
            basePrice = roomType.multiplier * 120000; // $1200 base
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
          description: 'Habitación con desayuno continental incluido',
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
      }),
      prisma.serviceType.create({
        data: {
          hotelId: hotel.id,
          name: 'Pensión Completa',
          description: 'Habitación con desayuno, almuerzo y cena',
          orderIndex: 4
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
            adjustment = { mode: 'PERCENTAGE', value: 12, isPermanent: true };
            break;
          case 'Media Pensión':
            adjustment = { mode: 'PERCENTAGE', value: 30, isPermanent: true };
            break;
          case 'Pensión Completa':
            adjustment = { mode: 'PERCENTAGE', value: 50, isPermanent: true };
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

    // 7. Crear configuración de precios dinámicos
    console.log('\n7. Creando configuración de precios dinámicos...');
    const dynamicPricingConfig = await prisma.dynamicPricingConfig.upsert({
      where: { hotelId: hotel.id },
      update: {},
      create: {
        hotelId: hotel.id,
        enabled: true,
        anticipationWeight: 0.2,
        globalOccupancyWeight: 0.25,
        isWeekendWeight: 0.15,
        weekendDays: [0, 6], // Domingo y sábado
        isHolidayWeight: 0.1,
        weatherScoreWeight: 0.05,
        eventImpactWeight: 0.1,
        maxAdjustmentPercentage: 0.4,
        enableGapPromos: true,
        enableWeatherApi: false,
        enableRecentDemand: false,
        anticipationMode: 'ESCALONADO',
        anticipationMaxDays: 30,
        anticipationSteps: [
          { days: 21, weight: 1.0 },
          { days: 14, weight: 0.7 },
          { days: 7, weight: 0.4 },
          { days: 3, weight: 0.2 }
        ],
        standardRate: 80000,
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
    console.log('✅ Configuración de precios dinámicos creada');

    // 8. Crear algunos keyframes estacionales de ejemplo
    console.log('\n8. Creando keyframes estacionales...');
    const keyframes = await Promise.all([
      prisma.seasonalKeyframe.create({
        data: {
          hotelId: hotel.id,
          date: new Date('2024-01-15'),
          basePrice: 120000 // Temporada alta
        }
      }),
      prisma.seasonalKeyframe.create({
        data: {
          hotelId: hotel.id,
          date: new Date('2024-04-15'),
          basePrice: 80000 // Temporada media
        }
      }),
      prisma.seasonalKeyframe.create({
        data: {
          hotelId: hotel.id,
          date: new Date('2024-07-15'),
          basePrice: 60000 // Temporada baja
        }
      }),
      prisma.seasonalKeyframe.create({
        data: {
          hotelId: hotel.id,
          date: new Date('2024-10-15'),
          basePrice: 80000 // Temporada media
        }
      }),
      prisma.seasonalKeyframe.create({
        data: {
          hotelId: hotel.id,
          date: new Date('2024-12-15'),
          basePrice: 120000 // Temporada alta
        }
      })
    ]);
    console.log('✅ Keyframes estacionales creados:', keyframes.length, 'registros');

    // 9. Verificar la estructura final
    console.log('\n9. Verificando estructura final...');
    
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
        },
        dynamicPricingConfig: true,
        seasonalKeyframes: true
      }
    });

    console.log('\n📊 RESUMEN FINAL DEL SISTEMA:');
    console.log('Hotel:', hotelWithData.name);
    console.log('Bloques de temporada:', hotelWithData.seasonBlocks.length);
    console.log('Tipos de servicio:', hotelWithData.serviceTypes.length);
    console.log('Keyframes estacionales:', hotelWithData.seasonalKeyframes.length);
    console.log('Precios dinámicos habilitados:', hotelWithData.dynamicPricingConfig?.enabled);
    
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

    console.log('\n✅ ¡Seed del sistema de tarifas completado exitosamente!');
    console.log('\n🎯 El nuevo sistema está listo para usar con:');
    console.log('- Bloques de temporada con precios base');
    console.log('- Tipos de servicio configurables');
    console.log('- Ajustes por servicio (fijos o porcentuales)');
    console.log('- Sistema de precios inteligentes mantenido');
    
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el seed
seedNewTariffSystem(); 