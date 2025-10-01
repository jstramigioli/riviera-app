const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDiversidadCulturalBlock() {
  try {
    console.log('🎉 Creando bloque "Fiesta de la diversidad cultural"...');

    // Crear el bloque de temporada
    const seasonBlock = await prisma.seasonBlock.create({
      data: {
        hotelId: 'default-hotel',
        name: 'Fiesta de la diversidad cultural',
        description: 'Bloque de temporada para la Fiesta de la diversidad cultural',
        startDate: new Date('2025-10-12'),
        endDate: new Date('2025-10-12'),
        isActive: true,
        orderIndex: 0,
        useBlockServices: false,
        useProportions: false,
        serviceAdjustmentMode: 'PERCENTAGE',
        isDraft: false
      }
    });

    console.log('✅ Bloque creado:', seasonBlock.id);

    // Mapeo de tipos de habitación
    const roomTypes = {
      single: 1,
      doble: 2,
      triple: 3,
      cuadruple: 4,
      quintuple: 9,
      tilo: 6,      // departamento El Tilo
      romerito: 5,  // departamento El Romerito
      via1: 7,      // departamento Via 1
      esquinita: 8  // departamento La Esquinita
    };

    // Tipos de servicio
    const serviceTypes = {
      base: 'cme7kpo5j0000nwnjj7vy418d',    // Tarifa base
      desayuno: 'cme7kpo5j0001nwnj0jez7i6h' // Desayuno
    };

    // Precios según tu tabla
    const prices = [
      // Single
      { roomTypeId: roomTypes.single, serviceTypeId: serviceTypes.base, basePrice: 67000 },
      { roomTypeId: roomTypes.single, serviceTypeId: serviceTypes.desayuno, basePrice: 75000 },
      
      // Doble
      { roomTypeId: roomTypes.doble, serviceTypeId: serviceTypes.base, basePrice: 108000 },
      { roomTypeId: roomTypes.doble, serviceTypeId: serviceTypes.desayuno, basePrice: 120000 },
      
      // Triple
      { roomTypeId: roomTypes.triple, serviceTypeId: serviceTypes.base, basePrice: 135000 },
      { roomTypeId: roomTypes.triple, serviceTypeId: serviceTypes.desayuno, basePrice: 150000 },
      
      // Cuádruple
      { roomTypeId: roomTypes.cuadruple, serviceTypeId: serviceTypes.base, basePrice: 162000 },
      { roomTypeId: roomTypes.cuadruple, serviceTypeId: serviceTypes.desayuno, basePrice: 180000 },
      
      // Quíntuple
      { roomTypeId: roomTypes.quintuple, serviceTypeId: serviceTypes.base, basePrice: 189000 },
      { roomTypeId: roomTypes.quintuple, serviceTypeId: serviceTypes.desayuno, basePrice: 210000 },
      
      // Departamento El Tilo (máx 5 personas con desayuno = $98.000)
      { roomTypeId: roomTypes.tilo, serviceTypeId: serviceTypes.base, basePrice: 77000 },
      { roomTypeId: roomTypes.tilo, serviceTypeId: serviceTypes.desayuno, basePrice: 98000 },
      
      // Departamento El Romerito (máx 2 personas con desayuno = $65.000)
      { roomTypeId: roomTypes.romerito, serviceTypeId: serviceTypes.base, basePrice: 50000 },
      { roomTypeId: roomTypes.romerito, serviceTypeId: serviceTypes.desayuno, basePrice: 65000 },
      
      // Departamento Via 1 (máx 5 personas con desayuno = $98.000)
      { roomTypeId: roomTypes.via1, serviceTypeId: serviceTypes.base, basePrice: 77000 },
      { roomTypeId: roomTypes.via1, serviceTypeId: serviceTypes.desayuno, basePrice: 98000 },
      
      // Departamento La Esquinita (máx 4 personas con desayuno = $110.000)
      { roomTypeId: roomTypes.esquinita, serviceTypeId: serviceTypes.base, basePrice: 89000 },
      { roomTypeId: roomTypes.esquinita, serviceTypeId: serviceTypes.desayuno, basePrice: 110000 }
    ];

    // Crear todos los precios
    console.log('💰 Creando precios...');
    for (const price of prices) {
      await prisma.seasonPrice.create({
        data: {
          seasonBlockId: seasonBlock.id,
          roomTypeId: price.roomTypeId,
          serviceTypeId: price.serviceTypeId,
          basePrice: price.basePrice,
          isDraft: false
        }
      });
    }

    console.log('✅ Precios creados exitosamente');
    console.log(`📊 Total de precios: ${prices.length}`);
    console.log('');
    console.log('🎉 Bloque "Fiesta de la diversidad cultural" creado exitosamente!');

  } catch (error) {
    console.error('❌ Error creando bloque:', error);
    console.error('Detalles:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createDiversidadCulturalBlock();


