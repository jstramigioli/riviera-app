const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugFrontendRoom16() {
  try {
    console.log('=== SIMULACIÓN FRONTEND - HABITACIÓN 16 ===\n');

    // Simular los parámetros que usa el frontend
    const startDate = new Date('2025-09-01');
    const endDate = new Date('2025-09-30');
    const roomId = 16; // Habitación 17

    console.log(`📅 Rango de fechas: ${startDate.toISOString().split('T')[0]} a ${endDate.toISOString().split('T')[0]}`);
    console.log(`🏨 Room ID: ${roomId}\n`);

    // Obtener todas las reservas (como hace el frontend)
    const allReservations = await prisma.reservation.findMany({
      include: {
        mainClient: true,
        segments: {
          where: { isActive: true },
          include: {
            room: true,
            roomType: true
          },
          orderBy: { startDate: 'asc' }
        }
      },
      orderBy: { id: 'asc' }
    });

    console.log(`📊 Total de reservas en BD: ${allReservations.length}`);

    // Filtrar por habitación (como hace el frontend)
    const roomReservations = allReservations.filter(reservation => 
      reservation.segments.some(segment => segment.roomId === roomId)
    );

    console.log(`🏨 Reservas que incluyen habitación ${roomId}: ${roomReservations.length}\n`);

    // Mostrar cada reserva filtrada
    roomReservations.forEach((reservation, index) => {
      console.log(`=== RESERVA ${index + 1} (ID: ${reservation.id}) ===`);
      console.log(`Estado: ${reservation.status}`);
      console.log(`Cliente: ${reservation.mainClient ? `${reservation.mainClient.firstName} ${reservation.mainClient.lastName}` : 'Sin cliente'}`);
      
      // Filtrar solo segmentos de esta habitación
      const roomSegments = reservation.segments.filter(segment => segment.roomId === roomId);
      
      console.log(`Segmentos en habitación ${roomId} (${roomSegments.length}):`);
      roomSegments.forEach((segment, segIndex) => {
        console.log(`  ${segIndex + 1}. ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]} - Habitación: ${segment.room.name} (Activo: ${segment.isActive})`);
      });
      console.log('');
    });

    // Simular el procesamiento del frontend para el grid
    console.log('=== PROCESAMIENTO PARA GRID ===');
    
    const gridReservations = [];
    
    roomReservations.forEach(reservation => {
      const roomSegments = reservation.segments.filter(segment => segment.roomId === roomId);
      
      roomSegments.forEach(segment => {
        // Verificar si el segmento está en el rango visible
        const segmentStart = new Date(segment.startDate);
        const segmentEnd = new Date(segment.endDate);
        
        if (segmentStart < endDate && segmentEnd > startDate) {
          gridReservations.push({
            id: reservation.id,
            status: reservation.status,
            clientName: reservation.mainClient ? `${reservation.mainClient.firstName} ${reservation.mainClient.lastName}` : 'Sin cliente',
            startDate: segment.startDate,
            endDate: segment.endDate,
            roomName: segment.room.name,
            isActive: segment.isActive
          });
        }
      });
    });

    console.log(`📊 Reservas que aparecerían en el grid: ${gridReservations.length}\n`);

    gridReservations.forEach((reservation, index) => {
      const statusIcon = reservation.status === 'confirmada' ? '✅' : 
                        reservation.status === 'pendiente' ? '⏳' : 
                        reservation.status === 'cancelada' ? '❌' : '❓';
      
      console.log(`${index + 1}. ${reservation.startDate.toISOString().split('T')[0]} a ${reservation.endDate.toISOString().split('T')[0]} - ${reservation.clientName} ${statusIcon} (ID: ${reservation.id}, Estado: ${reservation.status}, Activo: ${reservation.isActive})`);
    });

    // Verificar si hay reservas canceladas con segmentos activos
    const cancelledWithActiveSegments = gridReservations.filter(r => r.status === 'cancelada' && r.isActive);
    if (cancelledWithActiveSegments.length > 0) {
      console.log('\n⚠️ RESERVAS CANCELADAS CON SEGMENTOS ACTIVOS:');
      cancelledWithActiveSegments.forEach(r => {
        console.log(`  - Reserva ${r.id}: ${r.startDate.toISOString().split('T')[0]} a ${r.endDate.toISOString().split('T')[0]}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugFrontendRoom16(); 