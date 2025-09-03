const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFrontendSegments() {
  try {
    console.log('🧪 Probando funcionalidades de segmentos para el frontend...\n');

    // 1. Verificar que las reservas tienen segmentos
    console.log('📋 Test 1: Verificar estructura de reservas con segmentos');
    const reservations = await prisma.reservation.findMany({
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
      orderBy: { id: 'desc' },
      take: 5
    });

    console.log(`   Reservas encontradas: ${reservations.length}`);
    reservations.forEach((reservation, index) => {
      console.log(`   Reserva ${index + 1} (ID: ${reservation.id}):`);
      console.log(`     - Cliente: ${reservation.mainClient?.firstName} ${reservation.mainClient?.lastName}`);
      console.log(`     - Segmentos activos: ${reservation.segments.length}`);
      reservation.segments.forEach((segment, segIndex) => {
        console.log(`       Segmento ${segIndex + 1}: ${segment.room.name} (${segment.startDate.toISOString().split('T')[0]} - ${segment.endDate.toISOString().split('T')[0]})`);
      });
    });

    // 2. Verificar reservas multi-habitación
    console.log('\n📋 Test 2: Verificar reservas multi-habitación');
    const multiRoomReservations = reservations.filter(r => r.segments.length > 1);
    console.log(`   Reservas multi-habitación: ${multiRoomReservations.length}`);
    multiRoomReservations.forEach((reservation, index) => {
      console.log(`   Reserva ${index + 1} (ID: ${reservation.id}):`);
      const uniqueRooms = [...new Set(reservation.segments.map(s => s.room.name))];
      console.log(`     - Habitaciones: ${uniqueRooms.join(', ')}`);
      console.log(`     - Segmentos: ${reservation.segments.length}`);
    });

    // 3. Verificar segmentos consecutivos
    console.log('\n📋 Test 3: Verificar segmentos consecutivos');
    const consecutiveSegments = reservations.filter(reservation => {
      if (reservation.segments.length <= 1) return true;
      
      const sortedSegments = reservation.segments.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      
      for (let i = 0; i < sortedSegments.length - 1; i++) {
        const currentEnd = new Date(sortedSegments[i].endDate);
        const nextStart = new Date(sortedSegments[i + 1].startDate);
        
        if (currentEnd.getTime() !== nextStart.getTime()) {
          return false;
        }
      }
      return true;
    });

    console.log(`   Reservas con segmentos consecutivos: ${consecutiveSegments.length}/${reservations.length}`);
    
    const nonConsecutive = reservations.filter(r => !consecutiveSegments.includes(r));
    if (nonConsecutive.length > 0) {
      console.log(`   ⚠️ Reservas con segmentos no consecutivos:`);
      nonConsecutive.forEach(reservation => {
        console.log(`     Reserva ${reservation.id}:`);
        reservation.segments.forEach((segment, index) => {
          console.log(`       Segmento ${index + 1}: ${segment.startDate.toISOString().split('T')[0]} - ${segment.endDate.toISOString().split('T')[0]}`);
        });
      });
    }

    // 4. Verificar que no hay superposiciones
    console.log('\n📋 Test 4: Verificar ausencia de superposiciones');
    const allSegments = await prisma.reservationSegment.findMany({
      where: { isActive: true },
      include: {
        room: true,
        reservation: {
          include: { mainClient: true }
        }
      },
      orderBy: [
        { roomId: 'asc' },
        { startDate: 'asc' }
      ]
    });

    const roomSegments = {};
    allSegments.forEach(segment => {
      if (!roomSegments[segment.roomId]) {
        roomSegments[segment.roomId] = [];
      }
      roomSegments[segment.roomId].push(segment);
    });

    let hasOverlaps = false;
    Object.entries(roomSegments).forEach(([roomId, segments]) => {
      for (let i = 0; i < segments.length - 1; i++) {
        const current = segments[i];
        const next = segments[i + 1];
        
        if (new Date(current.endDate) > new Date(next.startDate)) {
          console.log(`   ❌ Superposición detectada en habitación ${roomId}:`);
          console.log(`     - Reserva ${current.reservation.id} (${current.reservation.mainClient?.firstName}): ${current.startDate.toISOString().split('T')[0]} - ${current.endDate.toISOString().split('T')[0]}`);
          console.log(`     - Reserva ${next.reservation.id} (${next.reservation.mainClient?.firstName}): ${next.startDate.toISOString().split('T')[0]} - ${next.endDate.toISOString().split('T')[0]}`);
          hasOverlaps = true;
        }
      }
    });

    if (!hasOverlaps) {
      console.log(`   ✅ No se detectaron superposiciones en ninguna habitación`);
    }

    // 5. Generar datos de ejemplo para el frontend
    console.log('\n📋 Test 5: Datos de ejemplo para el frontend');
    const exampleReservation = reservations[0];
    if (exampleReservation) {
      console.log(`   Ejemplo de reserva para el frontend:`);
      console.log(`   {`);
      console.log(`     "id": ${exampleReservation.id},`);
      console.log(`     "mainClientId": ${exampleReservation.mainClientId},`);
      console.log(`     "status": "${exampleReservation.status}",`);
      console.log(`     "isMultiRoom": ${exampleReservation.isMultiRoom},`);
      console.log(`     "mainClient": {`);
      console.log(`       "id": ${exampleReservation.mainClient.id},`);
      console.log(`       "firstName": "${exampleReservation.mainClient.firstName}",`);
      console.log(`       "lastName": "${exampleReservation.mainClient.lastName}"`);
      console.log(`     },`);
      console.log(`     "segments": [`);
      exampleReservation.segments.forEach((segment, index) => {
        console.log(`       {`);
        console.log(`         "id": ${segment.id},`);
        console.log(`         "roomId": ${segment.roomId},`);
        console.log(`         "startDate": "${segment.startDate.toISOString()}",`);
        console.log(`         "endDate": "${segment.endDate.toISOString()}",`);
        console.log(`         "baseRate": ${segment.baseRate},`);
        console.log(`         "guestCount": ${segment.guestCount},`);
        console.log(`         "isActive": ${segment.isActive},`);
        console.log(`         "room": {`);
        console.log(`           "id": ${segment.room.id},`);
        console.log(`           "name": "${segment.room.name}"`);
        console.log(`         }`);
        console.log(`       }${index < exampleReservation.segments.length - 1 ? ',' : ''}`);
      });
      console.log(`     ]`);
      console.log(`   }`);
    }

    console.log('\n✅ Pruebas completadas!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar las pruebas
testFrontendSegments(); 