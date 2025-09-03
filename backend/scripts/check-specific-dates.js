const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSpecificDates() {
  const checkIn = '2025-09-12';
  const checkOut = '2025-09-14';

  console.log('=== VERIFICACIÓN ESPECÍFICA DE FECHAS ===');
  console.log(`Fechas: ${checkIn} a ${checkOut}`);

  try {
    // Verificar segmentos de reserva que se solapan con estas fechas
    const overlappingSegments = await prisma.reservationSegment.findMany({
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
      include: {
        room: {
          include: {
            roomType: true
          }
        },
        reservation: {
          include: {
            mainClient: true
          }
        }
      },
      orderBy: [
        { roomId: 'asc' },
        { startDate: 'asc' }
      ]
    });

    console.log(`\nSegmentos que se solapan con las fechas:`);
    console.log(`Total: ${overlappingSegments.length}`);

    // Agrupar por habitación
    const roomsWithSegments = {};
    overlappingSegments.forEach(segment => {
      const roomId = segment.roomId;
      if (!roomsWithSegments[roomId]) {
        roomsWithSegments[roomId] = {
          room: segment.room,
          segments: []
        };
      }
      roomsWithSegments[roomId].segments.push(segment);
    });

    console.log(`\nHabitaciones con segmentos:`);
    Object.keys(roomsWithSegments).forEach(roomId => {
      const roomData = roomsWithSegments[roomId];
      const room = roomData.room;
      console.log(`\n${room.name} (${room.roomType.name} - ${room.maxPeople} pers.):`);
      roomData.segments.forEach(segment => {
        const client = segment.reservation.mainClient;
        console.log(`  - ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]} - ${client.firstName} ${client.lastName}`);
      });
    });

    // Verificar si hay habitaciones sin segmentos
    const allRooms = await prisma.room.findMany({
      where: {
        status: 'available'
      },
      include: {
        roomType: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    const occupiedRoomIds = Object.keys(roomsWithSegments).map(id => parseInt(id));
    const availableRooms = allRooms.filter(room => !occupiedRoomIds.includes(room.id));

    console.log(`\n=== RESUMEN ===`);
    console.log(`Total de habitaciones: ${allRooms.length}`);
    console.log(`Habitaciones ocupadas: ${occupiedRoomIds.length}`);
    console.log(`Habitaciones disponibles: ${availableRooms.length}`);

    if (availableRooms.length > 0) {
      console.log(`\nHabitaciones disponibles:`);
      availableRooms.forEach(room => {
        console.log(`  - ${room.name} (${room.roomType.name} - ${room.maxPeople} pers.)`);
      });
    } else {
      console.log(`\n❌ No hay habitaciones disponibles para estas fechas`);
    }

    // Verificar si hay algún problema con la lógica de solapamiento
    console.log(`\n=== VERIFICACIÓN DE LÓGICA DE SOLAPAMIENTO ===`);
    const testSegments = overlappingSegments.slice(0, 5); // Tomar los primeros 5 para verificar
    testSegments.forEach(segment => {
      const segmentStart = segment.startDate;
      const segmentEnd = segment.endDate;
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      const overlaps = segmentStart < checkOutDate && segmentEnd > checkInDate;
      console.log(`Segmento ${segment.room.name}: ${segmentStart.toISOString().split('T')[0]} a ${segmentEnd.toISOString().split('T')[0]}`);
      console.log(`  Solapa con ${checkIn} a ${checkOut}: ${overlaps ? 'SÍ' : 'NO'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificDates(); 