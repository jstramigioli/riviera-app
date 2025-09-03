const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listRoomReservations(roomIdentifier) {
  try {
    console.log(`=== RESERVAS DE LA HABITACIÓN ${roomIdentifier} ===\n`);

    // Buscar la habitación por ID o nombre
    let room;
    const roomId = parseInt(roomIdentifier);
    
    if (!isNaN(roomId)) {
      // Buscar por ID
      room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { roomType: true }
      });
    } else {
      // Buscar por nombre
      room = await prisma.room.findFirst({
        where: { name: roomIdentifier },
        include: { roomType: true }
      });
    }

    if (!room) {
      console.log(`❌ No se encontró la habitación: ${roomIdentifier}`);
      console.log('💡 Sugerencias:');
      console.log('   - Usa el ID de la habitación (ej: 16)');
      console.log('   - Usa el nombre de la habitación (ej: "17")');
      console.log('   - Verifica que la habitación existe');
      return;
    }

    console.log(`Habitación ${room.name} (ID: ${room.id}):`);
    console.log(`  - Tipo: ${room.roomType.name}`);
    console.log(`  - Capacidad: ${room.roomType.maxPeople} personas`);
    console.log(`  - Estado: ${room.status}\n`);

    // Obtener todas las reservas que tienen segmentos en esta habitación
    const reservations = await prisma.reservation.findMany({
      where: {
        segments: {
          some: {
            roomId: room.id,
            isActive: true
          }
        }
      },
      include: {
        mainClient: true,
        segments: {
          where: { roomId: room.id, isActive: true },
          include: {
            room: true,
            roomType: true
          },
          orderBy: { startDate: 'asc' }
        }
      },
      orderBy: { id: 'asc' }
    });

    console.log(`Total de reservas: ${reservations.length}\n`);

    if (reservations.length === 0) {
      console.log('📅 No hay reservas en esta habitación');
      return;
    }

    // Mostrar cada reserva
    reservations.forEach((reservation, index) => {
      console.log(`--- RESERVA ${index + 1} ---`);
      console.log(`ID: ${reservation.id}`);
      console.log(`Número de reserva: ${reservation.id}`);
      const clientName = reservation.mainClient ? `${reservation.mainClient.firstName} ${reservation.mainClient.lastName}` : 'Sin cliente';
      console.log(`Cliente: ${clientName}`);
      console.log(`Estado: ${reservation.status}`);
      console.log(`Segmentos en habitación ${room.name}:`);
      
      reservation.segments.forEach((segment, segIndex) => {
        console.log(`  ${segIndex + 1}. ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]} (Activo: ${segment.isActive})`);
      });
      console.log('');
    });

    // Mostrar cronología completa
    console.log('=== CRONOLOGÍA COMPLETA ===');
    const allSegments = [];
    
    reservations.forEach(reservation => {
      reservation.segments.forEach(segment => {
        allSegments.push({
          startDate: segment.startDate,
          endDate: segment.endDate,
          clientName: reservation.mainClient ? `${reservation.mainClient.firstName} ${reservation.mainClient.lastName}` : 'Sin cliente',
          reservationId: reservation.id,
          reservationNumber: reservation.id,
          status: reservation.status,
          isActive: segment.isActive
        });
      });
    });

    allSegments.sort((a, b) => a.startDate - b.startDate);

    allSegments.forEach((segment, index) => {
      const statusIcon = segment.status === 'confirmada' ? '✅' : 
                        segment.status === 'pendiente' ? '⏳' : 
                        segment.status === 'cancelada' ? '❌' : '❓';
      console.log(`${index + 1}. ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]} - ${segment.clientName} ${statusIcon} (Número: ${segment.reservationNumber}, Estado: ${segment.status})`);
    });

    console.log(`\nTotal de segmentos: ${allSegments.length}`);

    // Mostrar períodos libres
    console.log('\n=== PERÍODOS LIBRES (GAPS) ===');
    const gaps = [];
    
    if (allSegments.length > 0) {
      // Gap desde el inicio hasta la primera reserva
      const firstSegment = allSegments[0];
      if (firstSegment.startDate > new Date('2025-09-01')) {
        gaps.push({
          start: new Date('2025-09-01'),
          end: firstSegment.startDate,
          days: Math.ceil((firstSegment.startDate - new Date('2025-09-01')) / (1000 * 60 * 60 * 24))
        });
      }

      // Gaps entre segmentos
      for (let i = 0; i < allSegments.length - 1; i++) {
        const currentEnd = allSegments[i].endDate;
        const nextStart = allSegments[i + 1].startDate;
        
        if (nextStart > currentEnd) {
          gaps.push({
            start: currentEnd,
            end: nextStart,
            days: Math.ceil((nextStart - currentEnd) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // Gap desde la última reserva hasta el final del mes
      const lastSegment = allSegments[allSegments.length - 1];
      if (lastSegment.endDate < new Date('2025-09-30')) {
        gaps.push({
          start: lastSegment.endDate,
          end: new Date('2025-09-30'),
          days: Math.ceil((new Date('2025-09-30') - lastSegment.endDate) / (1000 * 60 * 60 * 24))
        });
      }
    } else {
      // Si no hay reservas, todo el mes está libre
      gaps.push({
        start: new Date('2025-09-01'),
        end: new Date('2025-09-30'),
        days: 30
      });
    }

    if (gaps.length === 0) {
      console.log('📅 No hay períodos libres - habitación completamente ocupada');
    } else {
      gaps.forEach((gap, index) => {
        console.log(`📅 Libre: ${gap.start.toISOString().split('T')[0]} a ${gap.end.toISOString().split('T')[0]} (${gap.days} días)`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('❌ Debes especificar una habitación');
    console.log('📖 Uso: node scripts/list-room-reservations.js <habitación>');
    console.log('');
    console.log('Ejemplos:');
    console.log('  node scripts/list-room-reservations.js 16');
    console.log('  node scripts/list-room-reservations.js "17"');
    console.log('  node scripts/list-room-reservations.js 18');
    return;
  }

  const roomIdentifier = args[0];
  await listRoomReservations(roomIdentifier);
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main();
}

module.exports = { listRoomReservations }; 