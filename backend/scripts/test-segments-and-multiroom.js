const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSegmentsAndMultiRoom() {
  try {
    console.log('🧪 Iniciando pruebas del sistema de segmentos y reservas multi-habitación...\n');

    // 1. Crear una reserva multi-habitación
    console.log('📋 1. Creando reserva multi-habitación...');
    
    const multiRoomReservation = await prisma.reservation.create({
      data: {
        roomId: 6, // Habitación 6
        mainClientId: 3, // Cliente 3
        checkIn: new Date('2025-03-01'),
        checkOut: new Date('2025-03-10'),
        totalAmount: 1800, // $180/noche por 10 noches
        status: 'active',
        reservationType: 'con_desayuno',
        notes: 'Familia García - 2 habitaciones',
        requiredGuests: 4,
        isMultiRoom: true
      }
    });

    console.log('✅ Reserva principal creada:', multiRoomReservation.id);

    // 2. Crear la reserva secundaria
    const childReservation = await prisma.reservation.create({
      data: {
        roomId: 7, // Habitación 7
        mainClientId: 3, // Mismo cliente
        checkIn: new Date('2025-03-01'),
        checkOut: new Date('2025-03-10'),
        totalAmount: 1600, // $160/noche por 10 noches
        status: 'active',
        reservationType: 'con_desayuno',
        notes: 'Parte de reserva multi-habitación #' + multiRoomReservation.id,
        requiredGuests: 2,
        isMultiRoom: true,
        parentReservationId: multiRoomReservation.id
      }
    });

    console.log('✅ Reserva secundaria creada:', childReservation.id);

    // 3. Crear segmentos para la reserva principal
    console.log('\n📋 2. Creando segmentos para la reserva principal...');
    
    // Segmento 1: 1-4 marzo (con cena)
    const segment1 = await prisma.reservationSegment.create({
      data: {
        reservationId: multiRoomReservation.id,
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-03-05'),
        roomId: 6,
        services: ['desayuno', 'almuerzo', 'cena'],
        baseRate: 200,
        reason: 'Período con cena',
        notes: 'Segmento 1: 1-4 marzo con todos los servicios'
      }
    });

    // Segmento 2: 5-10 marzo (sin cena)
    const segment2 = await prisma.reservationSegment.create({
      data: {
        reservationId: multiRoomReservation.id,
        startDate: new Date('2025-03-05'),
        endDate: new Date('2025-03-10'),
        roomId: 6,
        services: ['desayuno', 'almuerzo'],
        baseRate: 160,
        reason: 'Período sin cena',
        notes: 'Segmento 2: 5-10 marzo sin cena'
      }
    });

    console.log('✅ Segmentos creados para reserva principal');
    console.log('   - Segmento 1:', segment1.id, '(1-4 marzo con cena)');
    console.log('   - Segmento 2:', segment2.id, '(5-10 marzo sin cena)');

    // 4. Crear segmentos para la reserva secundaria
    console.log('\n📋 3. Creando segmentos para la reserva secundaria...');
    
    // Segmento 3: 1-7 marzo (habitación 7)
    const segment3 = await prisma.reservationSegment.create({
      data: {
        reservationId: childReservation.id,
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-03-08'),
        roomId: 7,
        services: ['desayuno', 'almuerzo', 'cena'],
        baseRate: 180,
        reason: 'Habitación adicional',
        notes: 'Segmento 3: Habitación 2 con todos los servicios'
      }
    });

    // Segmento 4: 8-10 marzo (cambio de habitación por mantenimiento)
    const segment4 = await prisma.reservationSegment.create({
      data: {
        reservationId: childReservation.id,
        startDate: new Date('2025-03-08'),
        endDate: new Date('2025-03-10'),
        roomId: 8, // Cambio a habitación 8
        services: ['desayuno', 'almuerzo'],
        baseRate: 150,
        reason: 'Cambio por mantenimiento',
        notes: 'Segmento 4: Cambio a habitación 3 por mantenimiento'
      }
    });

    console.log('✅ Segmentos creados para reserva secundaria');
    console.log('   - Segmento 3:', segment3.id, '(1-7 marzo, hab. 2)');
    console.log('   - Segmento 4:', segment4.id, '(8-10 marzo, hab. 3)');

    // 5. Consultar la reserva completa
    console.log('\n📋 4. Consultando reserva completa...');
    
    const completeReservation = await prisma.reservation.findUnique({
      where: { id: multiRoomReservation.id },
      include: {
        mainClient: true,
        room: true,
        segments: {
          orderBy: { startDate: 'asc' }
        },
        childReservations: {
          include: {
            room: true,
            segments: {
              orderBy: { startDate: 'asc' }
            }
          }
        }
      }
    });

    console.log('✅ Reserva completa obtenida:');
    console.log('   - Cliente:', completeReservation.mainClient.firstName, completeReservation.mainClient.lastName);
    console.log('   - Habitación principal:', completeReservation.room.name);
    console.log('   - Segmentos principales:', completeReservation.segments.length);
    console.log('   - Reservas secundarias:', completeReservation.childReservations.length);

    // 6. Mostrar detalles de los segmentos
    console.log('\n📋 5. Detalles de los segmentos:');
    
    console.log('\n🏠 Habitación Principal (', completeReservation.room.name, '):');
    completeReservation.segments.forEach((segment, index) => {
      console.log(`   ${index + 1}. ${segment.startDate.toISOString().split('T')[0]} - ${segment.endDate.toISOString().split('T')[0]}`);
      console.log(`      Servicios: ${segment.services.join(', ')}`);
      console.log(`      Tarifa: $${segment.baseRate}/noche`);
      console.log(`      Razón: ${segment.reason}`);
      console.log(`      Notas: ${segment.notes}`);
    });

    console.log('\n🏠 Habitación Secundaria (', completeReservation.childReservations[0].room.name, '):');
    completeReservation.childReservations[0].segments.forEach((segment, index) => {
      console.log(`   ${index + 1}. ${segment.startDate.toISOString().split('T')[0]} - ${segment.endDate.toISOString().split('T')[0]}`);
      console.log(`      Habitación: ${segment.roomId}`);
      console.log(`      Servicios: ${segment.services.join(', ')}`);
      console.log(`      Tarifa: $${segment.baseRate}/noche`);
      console.log(`      Razón: ${segment.reason}`);
      console.log(`      Notas: ${segment.notes}`);
    });

    // 7. Calcular tarifa total
    console.log('\n📋 6. Cálculo de tarifas:');
    
    let totalMainReservation = 0;
    completeReservation.segments.forEach(segment => {
      const days = Math.ceil((segment.endDate - segment.startDate) / (1000 * 60 * 60 * 24));
      const segmentTotal = days * segment.baseRate;
      totalMainReservation += segmentTotal;
      console.log(`   Hab. principal ${segment.startDate.toISOString().split('T')[0]}-${segment.endDate.toISOString().split('T')[0]}: ${days} días × $${segment.baseRate} = $${segmentTotal}`);
    });

    let totalChildReservation = 0;
    completeReservation.childReservations[0].segments.forEach(segment => {
      const days = Math.ceil((segment.endDate - segment.startDate) / (1000 * 60 * 60 * 24));
      const segmentTotal = days * segment.baseRate;
      totalChildReservation += segmentTotal;
      console.log(`   Hab. secundaria ${segment.startDate.toISOString().split('T')[0]}-${segment.endDate.toISOString().split('T')[0]}: ${days} días × $${segment.baseRate} = $${segmentTotal}`);
    });

    console.log(`\n💰 Total reserva principal: $${totalMainReservation}`);
    console.log(`💰 Total reserva secundaria: $${totalChildReservation}`);
    console.log(`💰 Total general: $${totalMainReservation + totalChildReservation}`);

    console.log('\n🎉 ¡Pruebas completadas exitosamente!');
    console.log('\n📊 Resumen:');
    console.log('   - ✅ Reserva multi-habitación creada');
    console.log('   - ✅ 4 segmentos creados (2 por habitación)');
    console.log('   - ✅ Cambios de servicios (con/sin cena)');
    console.log('   - ✅ Cambio de habitación por mantenimiento');
    console.log('   - ✅ Cálculo de tarifas por segmento');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar las pruebas
testSegmentsAndMultiRoom(); 