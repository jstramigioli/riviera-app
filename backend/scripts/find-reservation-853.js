const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findReservation853() {
  try {
    console.log('=== BUSCANDO RESERVA 853 ===\n');

    // Buscar la reserva 853
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
    console.log(`Segmentos: ${reservation.segments.length}\n`);

    reservation.segments.forEach((segment, index) => {
      console.log(`Segmento ${index + 1}:`);
      console.log(`  - Habitación: ${segment.room.name} (ID: ${segment.room.id})`);
      console.log(`  - Tipo: ${segment.roomType.name}`);
      console.log(`  - Fechas: ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]}`);
      console.log(`  - Activo: ${segment.isActive}`);
      console.log('');
    });

    // Verificar si hay múltiples habitaciones
    const uniqueRooms = [...new Set(reservation.segments.map(s => s.room.name))];
    console.log(`🏨 Habitaciones involucradas: ${uniqueRooms.join(', ')}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

findReservation853(); 