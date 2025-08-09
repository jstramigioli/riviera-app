const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initializeRateTypes() {
  try {
    console.log('Inicializando tipos de tarifa por defecto...');
    
    // Buscar el hotel por defecto
    const hotel = await prisma.hotel.findFirst({
      where: { id: 'default-hotel' }
    });
    
    if (!hotel) {
      console.log('Hotel por defecto no encontrado, creando...');
      await prisma.hotel.create({
        data: {
          id: 'default-hotel',
          name: 'Hotel Riviera',
          description: 'Hotel por defecto'
        }
      });
    }
    
    // Tipos de tarifa por defecto
    const defaultRateTypes = [
      {
        name: 'Con Desayuno',
        mode: 'FIXED',
        value: 15000,
        orderIndex: 0
      },
      {
        name: 'Con Media Pensión',
        mode: 'FIXED',
        value: 25000,
        orderIndex: 1
      }
    ];
    
    // Crear o actualizar tipos de tarifa
    for (const rateType of defaultRateTypes) {
      const existingRateType = await prisma.rateType.findFirst({
        where: {
          hotelId: 'default-hotel',
          name: rateType.name
        }
      });
      
      if (existingRateType) {
        console.log(`Actualizando tipo de tarifa: ${rateType.name}`);
        await prisma.rateType.update({
          where: { id: existingRateType.id },
          data: {
            mode: rateType.mode,
            value: rateType.value,
            orderIndex: rateType.orderIndex,
            isActive: true
          }
        });
      } else {
        console.log(`Creando tipo de tarifa: ${rateType.name}`);
        await prisma.rateType.create({
          data: {
            hotelId: 'default-hotel',
            ...rateType
          }
        });
      }
    }
    
    console.log('Tipos de tarifa inicializados exitosamente');
    
    // Mostrar los tipos de tarifa creados
    const rateTypes = await prisma.rateType.findMany({
      where: { 
        hotelId: 'default-hotel',
        isActive: true 
      },
      orderBy: { orderIndex: 'asc' }
    });
    
    console.log('Tipos de tarifa disponibles:');
    rateTypes.forEach(rt => {
      console.log(`- ${rt.name}: ${rt.mode} ${rt.value}`);
    });
    
  } catch (error) {
    console.error('Error inicializando tipos de tarifa:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeRateTypes(); 