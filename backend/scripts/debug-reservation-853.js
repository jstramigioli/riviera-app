const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugReservation853() {
  try {
    console.log('=== INVESTIGACIÓN RESERVA 853 ===\n');

    // Obtener la reserva 853 con todos sus segmentos
    const reservation = await prisma.reservation.findUnique({
      where: { id: 853 },
      include: {
        mainClient: true,
        segments: {
          include: {
            room: true,
            roomType: true
          },
          orderBy: { startDate: 'asc' }
        }
      }
    });

    if (!reservation) {
      console.log('❌ No se encontró la reserva 853');
      return;
    }

    console.log(`=== RESERVA 853 ===`);
    console.log(`ID: ${reservation.id}`);
    console.log(`Estado: ${reservation.status}`);
    console.log(`Cliente: ${reservation.mainClient ? `${reservation.mainClient.firstName} ${reservation.mainClient.lastName}` : 'Sin cliente'}`);
    console.log(`Notas: ${reservation.notes || 'Sin notas'}`);
    console.log(`Segmentos totales: ${reservation.segments.length}\n`);

    // Mostrar todos los segmentos de esta reserva
    console.log('=== TODOS LOS SEGMENTOS DE LA RESERVA 853 ===');
    reservation.segments.forEach((segment, index) => {
      console.log(`Segmento ${index + 1}:`);
      console.log(`  - Habitación: ${segment.room.name} (ID: ${segment.room.id})`);
      console.log(`  - Tipo: ${segment.roomType.name}`);
      console.log(`  - Fechas: ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]}`);
      console.log(`  - Activo: ${segment.isActive}`);
      console.log('');
    });

    // Verificar si hay segmentos en habitación 12
    const segmentsInRoom12 = reservation.segments.filter(segment => segment.roomId === 12);
    console.log(`=== SEGMENTOS EN HABITACIÓN 12 ===`);
    console.log(`Cantidad: ${segmentsInRoom12.length}`);
    
    if (segmentsInRoom12.length > 0) {
      segmentsInRoom12.forEach((segment, index) => {
        console.log(`Segmento ${index + 1}:`);
        console.log(`  - Habitación: ${segment.room.name} (ID: ${segment.room.id})`);
        console.log(`  - Fechas: ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]}`);
        console.log(`  - Activo: ${segment.isActive}`);
      });
    } else {
      console.log('❌ No hay segmentos en habitación 12');
    }

    // Verificar si hay segmentos en habitación 16
    const segmentsInRoom16 = reservation.segments.filter(segment => segment.roomId === 16);
    console.log(`\n=== SEGMENTOS EN HABITACIÓN 16 ===`);
    console.log(`Cantidad: ${segmentsInRoom16.length}`);
    
    if (segmentsInRoom16.length > 0) {
      segmentsInRoom16.forEach((segment, index) => {
        console.log(`Segmento ${index + 1}:`);
        console.log(`  - Habitación: ${segment.room.name} (ID: ${segment.room.id})`);
        console.log(`  - Fechas: ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]}`);
        console.log(`  - Activo: ${segment.isActive}`);
      });
    } else {
      console.log('❌ No hay segmentos en habitación 16');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugReservation853(); 