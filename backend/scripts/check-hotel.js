const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkHotel() {
  try {
    console.log('🔍 Verificando hotel por defecto...');
    
    const hotel = await prisma.hotel.findUnique({
      where: { id: 'default-hotel' }
    });
    
    if (hotel) {
      console.log('✅ Hotel encontrado:', hotel);
    } else {
      console.log('❌ Hotel no encontrado, creando...');
      
      const newHotel = await prisma.hotel.create({
        data: {
          id: 'default-hotel',
          name: 'Hotel Riviera',
          description: 'Hotel por defecto',
          isActive: true
        }
      });
      
      console.log('✅ Hotel creado:', newHotel);
    }
    
    // Verificar días de apertura
    const openDays = await prisma.openDay.findMany({
      where: { hotelId: 'default-hotel' }
    });
    
    console.log(`📅 Días de apertura encontrados: ${openDays.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkHotel(); 