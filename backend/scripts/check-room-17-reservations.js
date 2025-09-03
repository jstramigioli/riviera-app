const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoom17Reservations() {
  console.log('=== VERIFICACIÓN DE RESERVAS HABITACIÓN 17 - SEPTIEMBRE 2025 ===');

  try {
    // Buscar la habitación 17
    const room17 = await prisma.room.findFirst({
      where: { name: '17' },
      include: {
        roomType: true
      }
    });

    if (!room17) {
      console.log('❌ No se encontró habitación con nombre "17"');
      return;
    }

    console.log(`\nHabitación 17 (ID: ${room17.id}):`);
    console.log(`  - Tipo: ${room17.roomType.name}`);
    console.log(`  - Capacidad: ${room17.maxPeople} personas`);

    // Buscar todos los segmentos de septiembre para la habitación 17
    const septemberSegments = await prisma.reservationSegment.findMany({
      where: {
        roomId: room17.id,
        startDate: {
          gte: new Date('2025-09-01'),
          lt: new Date('2025-10-01')
        }
      },
      include: {
        reservation: {
          include: {
            mainClient: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    });

    console.log(`\nSegmentos de septiembre 2025:`);
    console.log(`Total: ${septemberSegments.length}`);

    septemberSegments.forEach(segment => {
      const client = segment.reservation.mainClient;
      console.log(`  - ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]} - ${client.firstName} ${client.lastName} (Activo: ${segment.isActive})`);
    });

    // Verificar si hay gaps (huecos) en las fechas
    console.log(`\nAnálisis de gaps:`);
    const sortedSegments = septemberSegments
      .filter(segment => segment.isActive)
      .sort((a, b) => a.startDate - b.startDate);

    if (sortedSegments.length === 0) {
      console.log(`  ✅ La habitación está completamente libre en septiembre`);
    } else {
      console.log(`  Primer segmento: ${sortedSegments[0].startDate.toISOString().split('T')[0]}`);
      console.log(`  Último segmento: ${sortedSegments[sortedSegments.length - 1].endDate.toISOString().split('T')[0]}`);
      
      // Verificar gaps entre segmentos
      for (let i = 0; i < sortedSegments.length - 1; i++) {
        const currentEnd = sortedSegments[i].endDate;
        const nextStart = sortedSegments[i + 1].startDate;
        
        if (currentEnd < nextStart) {
          const gapDays = Math.ceil((nextStart - currentEnd) / (1000 * 60 * 60 * 24));
          console.log(`  🔍 Gap encontrado: ${currentEnd.toISOString().split('T')[0]} a ${nextStart.toISOString().split('T')[0]} (${gapDays} días)`);
        }
      }
    }

    // Verificar específicamente las fechas del 11 al 18 de septiembre
    console.log(`\nVerificación específica del 11 al 18 de septiembre:`);
    const targetSegments = septemberSegments.filter(segment => {
      const segmentStart = segment.startDate;
      const segmentEnd = segment.endDate;
      const targetStart = new Date('2025-09-11');
      const targetEnd = new Date('2025-09-18');
      
      // Verificar si hay solapamiento
      return segmentStart < targetEnd && segmentEnd > targetStart;
    });

    console.log(`Segmentos que solapan con el 11-18 de septiembre: ${targetSegments.length}`);
    targetSegments.forEach(segment => {
      const client = segment.reservation.mainClient;
      console.log(`  - ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]} - ${client.firstName} ${client.lastName} (Activo: ${segment.isActive})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoom17Reservations(); 