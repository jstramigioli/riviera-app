const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugAvailableRooms() {
  const checkIn = '2025-09-12';
  const checkOut = '2025-09-14';
  const requiredGuests = 3;

  console.log('=== DEBUG BÚSQUEDA DE HABITACIONES DISPONIBLES ===');
  console.log(`Fechas: ${checkIn} a ${checkOut}`);
  console.log(`Huéspedes requeridos: ${requiredGuests}`);

  try {
    // 1. Verificar bloques de temporada
    console.log('\n1. Verificando bloques de temporada...');
    const checkInDate = new Date(checkIn);
    const seasonBlocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId: 'default-hotel',
        startDate: { lte: checkInDate },
        endDate: { gte: checkInDate }
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isDraft: true
      },
      orderBy: { isDraft: 'asc' }
    });

    console.log(`Bloques encontrados: ${seasonBlocks.length}`);
    seasonBlocks.forEach(block => {
      console.log(`  - ${block.name} (${block.isDraft ? 'Borrador' : 'Activo'}): ${block.startDate.toISOString().split('T')[0]} a ${block.endDate.toISOString().split('T')[0]}`);
    });

    // 2. Verificar habitaciones ocupadas
    console.log('\n2. Verificando habitaciones ocupadas...');
    const occupiedRooms = await prisma.reservationSegment.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                startDate: { lt: new Date(checkOut) },
                endDate: { gt: new Date(checkIn) }
              }
            ]
          },
          {
            isActive: true
          }
        ]
      },
      select: { 
        roomId: true,
        startDate: true,
        endDate: true
      }
    });

    console.log(`Segmentos de reserva ocupados: ${occupiedRooms.length}`);
    occupiedRooms.forEach(segment => {
      console.log(`  - Habitación ${segment.roomId}: ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]}`);
    });

    const occupiedRoomIds = occupiedRooms.map(r => r.roomId);
    console.log(`IDs de habitaciones ocupadas: [${occupiedRoomIds.join(', ')}]`);

    // 3. Verificar todas las habitaciones
    console.log('\n3. Verificando todas las habitaciones...');
    const allRooms = await prisma.room.findMany({
      where: {
        status: 'available'
      },
      include: {
        roomType: true,
        tags: true
      }
    });

    console.log(`Total de habitaciones disponibles: ${allRooms.length}`);
    allRooms.forEach(room => {
      const isOccupied = occupiedRoomIds.includes(room.id);
      console.log(`  - ${room.name} (${room.roomType.name}): ${room.maxPeople} pers. ${isOccupied ? '❌ OCUPADA' : '✅ DISPONIBLE'}`);
    });

    // 4. Verificar habitaciones disponibles (sin ocupadas)
    console.log('\n4. Verificando habitaciones realmente disponibles...');
    const availableRooms = allRooms.filter(room => !occupiedRoomIds.includes(room.id));
    console.log(`Habitaciones realmente disponibles: ${availableRooms.length}`);
    availableRooms.forEach(room => {
      console.log(`  - ${room.name} (${room.roomType.name}): ${room.maxPeople} pers.`);
    });

    // 5. Verificar habitaciones que cumplen capacidad
    console.log('\n5. Verificando habitaciones que cumplen capacidad...');
    const capacityRooms = availableRooms.filter(room => room.maxPeople >= requiredGuests);
    console.log(`Habitaciones con capacidad >= ${requiredGuests}: ${capacityRooms.length}`);
    capacityRooms.forEach(room => {
      console.log(`  - ${room.name} (${room.roomType.name}): ${room.maxPeople} pers. ${room.maxPeople === requiredGuests ? '(Capacidad exacta)' : '(Mayor capacidad)'}`);
    });

    // 6. Verificar habitaciones virtuales
    console.log('\n6. Verificando habitaciones virtuales...');
    const virtualRooms = await prisma.virtualRoom.findMany({
      where: {
        isActive: true
      },
      include: {
        roomType: true,
        components: {
          include: {
            room: true
          }
        }
      }
    });

    console.log(`Habitaciones virtuales activas: ${virtualRooms.length}`);
    virtualRooms.forEach(vr => {
      const componentRoomIds = vr.components.map(comp => comp.roomId);
      const isAvailable = !componentRoomIds.some(roomId => occupiedRoomIds.includes(roomId));
      console.log(`  - ${vr.name} (${vr.roomType.name}): ${vr.maxPeople} pers. ${isAvailable ? '✅ DISPONIBLE' : '❌ OCUPADA'}`);
      console.log(`    Componentes: ${vr.components.map(c => `${c.room.name} (${c.room.maxPeople} pers.)`).join(', ')}`);
    });

    // 7. Verificar tarifas
    console.log('\n7. Verificando tarifas...');
    if (seasonBlocks.length > 0) {
      const activeBlock = seasonBlocks.find(block => !block.isDraft);
      if (activeBlock) {
        console.log(`Bloque activo: ${activeBlock.name}`);
        
        const seasonPrices = await prisma.seasonPrice.findMany({
          where: {
            seasonBlockId: activeBlock.id
          },
          include: {
            roomType: true,
            serviceType: true
          }
        });

        console.log(`Tarifas configuradas: ${seasonPrices.length}`);
        seasonPrices.forEach(price => {
          const serviceName = price.serviceType ? price.serviceType.name : 'Sin servicio';
          console.log(`  - ${price.roomType.name} (${serviceName}): $${price.basePrice}`);
        });
      } else {
        console.log('❌ No hay bloques activos, solo borradores');
      }
    } else {
      console.log('❌ No hay bloques de temporada para estas fechas');
    }

    console.log('\n=== FIN DEBUG ===');

  } catch (error) {
    console.error('Error en debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAvailableRooms(); 