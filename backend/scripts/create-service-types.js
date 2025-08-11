const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createServiceTypes() {
  try {
    console.log('🚀 Creando tipos de servicio básicos...');
    
    const hotelId = 'default-hotel';
    
    // Verificar que el hotel existe
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId }
    });
    
    if (!hotel) {
      console.error('❌ No se encontró el hotel default-hotel');
      return;
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

    console.log('✅ Tipos de servicio creados exitosamente');
    
    // Mostrar los tipos creados
    const createdTypes = await prisma.serviceType.findMany({
      where: { hotelId: hotel.id },
      orderBy: { orderIndex: 'asc' }
    });
    
    console.log('📋 Tipos de servicio disponibles:');
    createdTypes.forEach(type => {
      console.log(`   - ${type.name} (ID: ${type.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error creando tipos de servicio:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createServiceTypes(); 