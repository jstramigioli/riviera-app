const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugReservation978() {
  console.log('=== DEBUG RESERVATION 978 ===');

  try {
    // Buscar la reserva 978
    const reservation = await prisma.reservation.findUnique({
      where: { id: 978 },
      include: {
        mainClient: true,
        segments: {
          include: {
            room: true
          },
          orderBy: {
            startDate: 'asc'
          }
        }
      }
    });

    if (!reservation) {
      console.log('❌ No se encontró la reserva 978');
      return;
    }

    console.log(`\nReserva 978:`);
    console.log(`  - Cliente: ${reservation.mainClient.firstName} ${reservation.mainClient.lastName}`);
    console.log(`  - Estado: ${reservation.status}`);
    console.log(`  - Notas: ${reservation.notes || 'Sin notas'}`);
    console.log(`  - Creada: ${reservation.createdAt.toISOString()}`);
    console.log(`  - Actualizada: ${reservation.updatedAt.toISOString()}`);

    console.log(`\nSegmentos:`);
    reservation.segments.forEach((segment, index) => {
      console.log(`  ${index + 1}. ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]}`);
      console.log(`     - Habitación: ${segment.room.name} (ID: ${segment.room.id})`);
      console.log(`     - Activo: ${segment.isActive}`);
      console.log(`     - Tarifa base: ${segment.baseRate}`);
      console.log(`     - Huéspedes: ${segment.guestCount}`);
      console.log(`     - Razón: ${segment.reason}`);
    });

    // Verificar si debería aparecer en el grid
    console.log(`\nAnálisis para el grid:`);
    
    const activeSegments = reservation.segments.filter(s => s.isActive);
    console.log(`  - Segmentos activos: ${activeSegments.length}`);
    
    if (activeSegments.length > 0) {
      console.log(`  - ✅ DEBERÍA aparecer en el grid (tiene segmentos activos)`);
      
      // Calcular fechas para el grid
      const checkIn = new Date(Math.min(...activeSegments.map(s => new Date(s.startDate))));
      const checkOut = new Date(Math.max(...activeSegments.map(s => new Date(s.endDate))));
      
      console.log(`  - Fechas calculadas: ${checkIn.toISOString().split('T')[0]} a ${checkOut.toISOString().split('T')[0]}`);
    } else {
      console.log(`  - ❌ NO debería aparecer en el grid (no tiene segmentos activos)`);
    }

    // Verificar si el estado de la reserva debería afectar la visualización
    console.log(`\nEstado de la reserva:`);
    console.log(`  - Estado actual: ${reservation.status}`);
    
    if (reservation.status === 'cancelada') {
      console.log(`  - ⚠️  La reserva está cancelada pero tiene segmentos activos`);
      console.log(`  - Esto podría ser un problema de consistencia de datos`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugReservation978(); 