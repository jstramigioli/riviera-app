const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFrontendReservations() {
  console.log('=== VERIFICACIÓN DE RESERVAS PARA EL FRONTEND ===');

  try {
    // Simular la función getAllReservationsWithData
    const reservations = await prisma.reservation.findMany({
      include: {
        mainClient: true,
        guests: true,
        segments: {
          where: { isActive: true },
          include: {
            room: true,
            roomType: true
          },
          orderBy: { startDate: 'asc' }
        },
        childReservations: {
          include: {
            segments: {
              where: { isActive: true },
              include: {
                room: true,
                roomType: true
              },
              orderBy: { startDate: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Total de reservas en BD: ${reservations.length}`);

    // Procesar cada reserva como lo hace getReservationData
    const processedReservations = [];
    
    reservations.forEach((reservation, index) => {
      if (!reservation.segments || reservation.segments.length === 0) {
        console.log(`Reserva ${reservation.id}: Sin segmentos activos`);
        return;
      }

      const activeSegments = reservation.segments.filter(s => s.isActive);
      
      if (activeSegments.length === 0) {
        console.log(`Reserva ${reservation.id}: Sin segmentos activos`);
        return;
      }

      // Calcular fechas
      const checkIn = new Date(Math.min(...activeSegments.map(s => new Date(s.startDate))));
      const checkOut = new Date(Math.max(...activeSegments.map(s => new Date(s.endDate))));
      
      // Obtener datos del primer segmento activo
      const firstSegment = activeSegments[0];
      
      const processedReservation = {
        id: reservation.id,
        mainClientId: reservation.mainClientId,
        checkIn,
        checkOut,
        status: reservation.status,
        notes: reservation.notes,
        roomId: firstSegment.roomId,
        room: firstSegment.room,
        mainClient: reservation.mainClient,
        segments: activeSegments
      };

      processedReservations.push(processedReservation);
      
      console.log(`\nReserva ${reservation.id}:`);
      console.log(`  - Cliente: ${reservation.mainClient.firstName} ${reservation.mainClient.lastName}`);
      console.log(`  - Estado: ${reservation.status}`);
      console.log(`  - Habitación: ${firstSegment.room.name} (ID: ${firstSegment.roomId})`);
      console.log(`  - Fechas: ${checkIn.toISOString().split('T')[0]} a ${checkOut.toISOString().split('T')[0]}`);
      console.log(`  - Segmentos activos: ${activeSegments.length}`);
    });

    console.log(`\n=== RESUMEN ===`);
    console.log(`Reservas procesadas: ${processedReservations.length}`);
    
    // Filtrar por habitación 17 (ID: 16)
    const room17Reservations = processedReservations.filter(r => r.roomId === 16);
    console.log(`Reservas para habitación 17: ${room17Reservations.length}`);
    
    room17Reservations.forEach(reservation => {
      console.log(`  - Reserva ${reservation.id}: ${reservation.checkIn.toISOString().split('T')[0]} a ${reservation.checkOut.toISOString().split('T')[0]} (${reservation.status})`);
    });

    // Verificar si la reserva 978 está incluida
    const reservation978 = processedReservations.find(r => r.id === 978);
    if (reservation978) {
      console.log(`\n✅ Reserva 978 SÍ está incluida en los datos del frontend`);
      console.log(`  - roomId: ${reservation978.roomId}`);
      console.log(`  - Habitación: ${reservation978.room.name}`);
    } else {
      console.log(`\n❌ Reserva 978 NO está incluida en los datos del frontend`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFrontendReservations(); 