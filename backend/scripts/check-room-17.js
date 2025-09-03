const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoom17() {
  const checkIn = '2025-09-12';
  const checkOut = '2025-09-14';

  console.log('=== VERIFICACIÓN ESPECÍFICA HABITACIÓN 17 ===');
  console.log(`Fechas consulta: ${checkIn} a ${checkOut}`);

  try {
    // Verificar todas las habitaciones para encontrar la correcta
    console.log('\n1. Verificando todas las habitaciones:');
    const allRooms = await prisma.room.findMany({
      include: {
        roomType: true,
        tags: true
      },
      orderBy: {
        id: 'asc'
      }
    });

    allRooms.forEach(room => {
      console.log(`  ID ${room.id}: ${room.name} (${room.roomType.name} - ${room.maxPeople} pers.)`);
    });

    // Buscar específicamente la habitación que se llama "17"
    console.log('\n2. Buscando habitación con nombre "17":');
    const room17 = allRooms.find(room => room.name === '17');
    
    if (room17) {
      console.log(`  Encontrada: ID ${room17.id}, Nombre: ${room17.name}, Tipo: ${room17.roomType.name}, Capacidad: ${room17.maxPeople}`);
    } else {
      console.log('  ❌ No se encontró habitación con nombre "17"');
      return;
    }

    // Verificar segmentos de reserva de la habitación correcta
    const segments17 = await prisma.reservationSegment.findMany({
      where: {
        roomId: room17.id,
        isActive: true
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

    console.log(`\n3. Segmentos de reserva de la habitación ${room17.name} (ID: ${room17.id}):`);
    console.log(`Total: ${segments17.length}`);

    segments17.forEach(segment => {
      const client = segment.reservation.mainClient;
      console.log(`  - ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]} - ${client.firstName} ${client.lastName}`);
    });

    // Verificar si hay solapamiento con las fechas de consulta
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    console.log(`\n4. Verificación de solapamiento:`);
    console.log(`Fechas de consulta: ${checkInDate.toISOString().split('T')[0]} a ${checkOutDate.toISOString().split('T')[0]}`);

    const overlappingSegments = segments17.filter(segment => {
      const segmentStart = segment.startDate;
      const segmentEnd = segment.endDate;
      
      // Verificar solapamiento
      const overlaps = segmentStart < checkOutDate && segmentEnd > checkInDate;
      
      console.log(`  Segmento: ${segmentStart.toISOString().split('T')[0]} a ${segmentEnd.toISOString().split('T')[0]}`);
      console.log(`    - segmentStart < checkOutDate: ${segmentStart.toISOString().split('T')[0]} < ${checkOutDate.toISOString().split('T')[0]} = ${segmentStart < checkOutDate}`);
      console.log(`    - segmentEnd > checkInDate: ${segmentEnd.toISOString().split('T')[0]} > ${checkInDate.toISOString().split('T')[0]} = ${segmentEnd > checkInDate}`);
      console.log(`    - Solapa: ${overlaps ? 'SÍ' : 'NO'}`);
      
      return overlaps;
    });

    console.log(`\n5. Resultado:`);
    console.log(`Segmentos que solapan: ${overlappingSegments.length}`);
    
    if (overlappingSegments.length === 0) {
      console.log(`✅ La habitación ${room17.name} DEBERÍA estar disponible`);
      console.log(`  - Capacidad: ${room17.maxPeople} personas (requeridas: 3)`);
      console.log(`  - Tipo: ${room17.roomType.name}`);
    } else {
      console.log(`❌ La habitación ${room17.name} NO está disponible debido a solapamiento`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoom17(); 