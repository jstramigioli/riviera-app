const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedRestructuredTariffSystem() {
  try {
    console.log('🌱 Poblando el nuevo sistema de tarifas reestructurado...\n');

    // 1. Obtener o crear hotel principal
    console.log('1. Verificando hotel principal...');
    let hotel = await prisma.hotel.findFirst({
      where: { id: 'default-hotel' }
    });
    
    if (!hotel) {
      hotel = await prisma.hotel.create({
        data: {
          id: 'default-hotel',
          name: 'Hotel Riviera',
          description: 'Hotel principal del sistema',
          address: 'Av. Costanera 123',
          phone: '+54 11 1234-5678',
          email: 'info@hotelriviera.com',
          website: 'https://hotelriviera.com'
        }
      });
    }
    console.log('✅ Hotel:', hotel.name);

    // 2. Verificar tipos de habitación existentes
    console.log('\n2. Verificando tipos de habitación...');
    let roomTypes = await prisma.roomType.findMany({
      orderBy: { orderIndex: 'asc' }
    });
    
    if (roomTypes.length === 0) {
      roomTypes = await Promise.all([
        prisma.roomType.create({
          data: {
            name: 'Individual',
            description: 'Habitación individual con baño privado',
            multiplier: 1.0,
            orderIndex: 1
          }
        }),
        prisma.roomType.create({
          data: {
            name: 'Doble',
            description: 'Habitación doble con baño privado',
            multiplier: 1.5,
            orderIndex: 2
          }
        }),
        prisma.roomType.create({
          data: {
            name: 'Triple',
            description: 'Habitación triple con baño privado',
            multiplier: 1.8,
            orderIndex: 3
          }
        }),
        prisma.roomType.create({
          data: {
            name: 'Suite',
            description: 'Suite de lujo con living y baño privado',
            multiplier: 2.5,
            orderIndex: 4
          }
        })
      ]);
    }
    console.log('✅ Tipos de habitación:', roomTypes.map(rt => rt.name));

    // 3. Crear tipos de servicio
    console.log('\n3. Creando tipos de servicio...');
    
    // Limpiar tipos de servicio existentes
    await prisma.seasonServiceAdjustment.deleteMany({});
    await prisma.serviceType.deleteMany({ where: { hotelId: hotel.id } });
    
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
    console.log('✅ Tipos de servicio:', serviceTypes.map(st => st.name));

    // 4. Crear bloques de temporada
    console.log('\n4. Creando bloques de temporada...');
    
    // Limpiar bloques existentes
    await prisma.seasonServiceAdjustment.deleteMany({});
    await prisma.seasonPrice.deleteMany({});
    await prisma.seasonBlock.deleteMany({ where: { hotelId: hotel.id } });
    
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
          description: 'Temporada de demanda media (abril-mayo)',
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
    console.log('✅ Bloques de temporada:', seasonBlocks.map(sb => sb.name));

    // 5. Crear precios base por temporada
    console.log('\n5. Creando precios base por temporada...');
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

    // 6. Crear ajustes por servicio dentro de cada bloque
    console.log('\n6. Creando ajustes por servicio en cada bloque...');
    const seasonServiceAdjustments = [];
    
    for (const block of seasonBlocks) {
      for (const serviceType of serviceTypes) {
        for (const roomType of roomTypes) {
          let adjustment;
          
          switch (serviceType.name) {
            case 'Solo Alojamiento':
              adjustment = { mode: 'FIXED', value: 0 };
              break;
            case 'Con Desayuno':
              adjustment = { mode: 'PERCENTAGE', value: 12 };
              break;
            case 'Media Pensión':
              adjustment = { mode: 'PERCENTAGE', value: 30 };
              break;
            case 'Pensión Completa':
              adjustment = { mode: 'PERCENTAGE', value: 50 };
              break;
          }
          
          const seasonServiceAdjustment = await prisma.seasonServiceAdjustment.create({
            data: {
              seasonBlockId: block.id,
              serviceTypeId: serviceType.id,
              roomTypeId: roomType.id,
              ...adjustment
            }
          });
          seasonServiceAdjustments.push(seasonServiceAdjustment);
        }
      }
    }
    console.log('✅ Ajustes por servicio creados:', seasonServiceAdjustments.length, 'registros');

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
            },
            seasonServiceAdjustments: {
              include: {
                serviceType: true,
                roomType: true
              }
            }
          }
        },
        serviceTypes: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    console.log('\n📊 RESUMEN DE LA ESTRUCTURA CREADA:');
    console.log('Hotel:', hotelWithData.name);
    console.log('Bloques de temporada:', hotelWithData.seasonBlocks.length);
    console.log('Tipos de servicio:', hotelWithData.serviceTypes.length);
    console.log('Precios base:', seasonPrices.length);
    console.log('Ajustes por servicio:', seasonServiceAdjustments.length);
    
    console.log('\n📋 BLOQUES DE TEMPORADA:');
    for (const block of hotelWithData.seasonBlocks) {
      console.log(`\n- ${block.name} (${block.startDate.toLocaleDateString()} - ${block.endDate.toLocaleDateString()})`);
      
      console.log('  Precios base:');
      for (const price of block.seasonPrices) {
        console.log(`    ${price.roomType.name}: $${price.basePrice.toLocaleString()}`);
      }
      
      console.log('  Ajustes por servicio:');
      const adjustmentsByService = {};
      for (const adj of block.seasonServiceAdjustments) {
        if (!adjustmentsByService[adj.serviceType.name]) {
          adjustmentsByService[adj.serviceType.name] = [];
        }
        adjustmentsByService[adj.serviceType.name].push(adj);
      }
      
      for (const [serviceName, adjustments] of Object.entries(adjustmentsByService)) {
        console.log(`    ${serviceName}:`);
        for (const adj of adjustments) {
          const modeText = adj.mode === 'FIXED' ? 'fijo' : 'porcentaje';
          const valueText = adj.mode === 'FIXED' ? `$${adj.value}` : `${adj.value}%`;
          console.log(`      ${adj.roomType.name}: ${valueText} (${modeText})`);
        }
      }
    }
    
    console.log('\n📋 TIPOS DE SERVICIO GLOBALES:');
    for (const service of hotelWithData.serviceTypes) {
      console.log(`- ${service.name}: ${service.description}`);
    }

    console.log('\n✅ ¡Sistema de tarifas reestructurado completado exitosamente!');
    console.log('\n🎯 CARACTERÍSTICAS DEL NUEVO SISTEMA:');
    console.log('- ❌ Eliminados: Periodos operacionales, MealPricingRule, RateType, DailyRate');
    console.log('- ✅ Mantenidos: Precios inteligentes, tipos de habitaciones');
    console.log('- 🆕 Nuevos: Bloques de temporada con ajustes por servicio integrados');
    console.log('- 🔄 Orden de cálculo: Tarifa base → Ajuste por servicio → Precios inteligentes');
    console.log('- 📊 Vista: Cards independientes por bloque (no timeline)');
    console.log('- 🛠️ CRUD: Tipos de servicio completamente configurables');
    
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el seed
seedRestructuredTariffSystem(); 