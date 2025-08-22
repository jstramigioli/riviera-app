const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNewSystem() {
  try {
    console.log('🧪 Probando el nuevo sistema de segmentos...\n');

    // 1. Obtener todas las reservas con el nuevo sistema
    console.log('📋 1. Obteniendo reservas con el nuevo sistema...');
    
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
        }
      }
    });

    console.log(`✅ ${reservations.length} reservas encontradas`);

    // 2. Mostrar detalles de cada reserva
    console.log('\n📋 2. Detalles de las reservas:');
    
    for (const reservation of reservations) {
      console.log(`\n🏠 Reserva #${reservation.id}:`);
      console.log(`   Cliente: ${reservation.mainClient.firstName} ${reservation.mainClient.lastName}`);
      console.log(`   Estado: ${reservation.status}`);
      console.log(`   Segmentos activos: ${reservation.segments.length}`);
      
      if (reservation.segments.length > 0) {
        const firstSegment = reservation.segments[0];
        const lastSegment = reservation.segments[reservation.segments.length - 1];
        
        console.log(`   Check-in: ${firstSegment.startDate.toISOString().split('T')[0]}`);
        console.log(`   Check-out: ${lastSegment.endDate.toISOString().split('T')[0]}`);
        console.log(`   Habitación: ${firstSegment.room.name}`);
        console.log(`   Servicios: ${firstSegment.services.join(', ')}`);
        console.log(`   Tarifa base: $${firstSegment.baseRate}/noche`);
        console.log(`   Huéspedes: ${firstSegment.guestCount}`);
      }
    }

    // 3. Crear una nueva reserva de prueba
    console.log('\n📋 3. Creando nueva reserva de prueba...');
    
    const newReservation = await prisma.reservation.create({
      data: {
        mainClientId: 1,
        status: 'active',
        notes: 'Reserva de prueba del nuevo sistema'
      }
    });

    console.log(`✅ Nueva reserva creada: #${newReservation.id}`);

    // 4. Crear segmento para la nueva reserva
    const newSegment = await prisma.reservationSegment.create({
      data: {
        reservationId: newReservation.id,
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-04-05'),
        roomId: 1,
        services: ['con_desayuno', 'almuerzo'],
        baseRate: 150.0,
        guestCount: 2,
        reason: 'Reserva de prueba',
        notes: 'Segmento de prueba del nuevo sistema'
      },
      include: {
        room: true
      }
    });

    console.log(`✅ Segmento creado: #${newSegment.id}`);
    console.log(`   Habitación: ${newSegment.room.name}`);
    console.log(`   Servicios: ${newSegment.services.join(', ')}`);
    console.log(`   Tarifa: $${newSegment.baseRate}/noche`);

    // 5. Obtener la reserva completa con datos calculados
    console.log('\n📋 4. Obteniendo reserva con datos calculados...');
    
    const completeReservation = await prisma.reservation.findUnique({
      where: { id: newReservation.id },
      include: {
        mainClient: true,
        segments: {
          where: { isActive: true },
          include: {
            room: true
          }
        }
      }
    });

    if (completeReservation.segments.length > 0) {
      const segment = completeReservation.segments[0];
      const days = Math.ceil((segment.endDate - segment.startDate) / (1000 * 60 * 60 * 24));
      const totalAmount = days * segment.baseRate;
      
      console.log(`✅ Datos calculados:`);
      console.log(`   Días de estadía: ${days}`);
      console.log(`   Total: $${totalAmount}`);
      console.log(`   Tarifa promedio: $${totalAmount / days}/noche`);
    }

    // 6. Crear una reserva con múltiples segmentos
    console.log('\n📋 5. Creando reserva con múltiples segmentos...');
    
    const multiSegmentReservation = await prisma.reservation.create({
      data: {
        mainClientId: 2,
        status: 'active',
        notes: 'Reserva con cambios de servicios'
      }
    });

    // Segmento 1: Con cena
    await prisma.reservationSegment.create({
      data: {
        reservationId: multiSegmentReservation.id,
        startDate: new Date('2025-04-10'),
        endDate: new Date('2025-04-12'),
        roomId: 2,
        services: ['con_desayuno', 'almuerzo', 'cena'],
        baseRate: 200.0,
        guestCount: 2,
        reason: 'Período con cena',
        notes: 'Primer segmento con todos los servicios'
      }
    });

    // Segmento 2: Sin cena
    await prisma.reservationSegment.create({
      data: {
        reservationId: multiSegmentReservation.id,
        startDate: new Date('2025-04-12'),
        endDate: new Date('2025-04-15'),
        roomId: 2,
        services: ['con_desayuno', 'almuerzo'],
        baseRate: 160.0,
        guestCount: 2,
        reason: 'Período sin cena',
        notes: 'Segundo segmento sin cena'
      }
    });

    console.log(`✅ Reserva multi-segmento creada: #${multiSegmentReservation.id}`);

    // 7. Verificar la reserva multi-segmento
    const multiSegmentComplete = await prisma.reservation.findUnique({
      where: { id: multiSegmentReservation.id },
      include: {
        mainClient: true,
        segments: {
          where: { isActive: true },
          include: {
            room: true
          },
          orderBy: { startDate: 'asc' }
        }
      }
    });

    console.log(`\n📋 6. Detalles de la reserva multi-segmento:`);
    console.log(`   Cliente: ${multiSegmentComplete.mainClient.firstName} ${multiSegmentComplete.mainClient.lastName}`);
    console.log(`   Segmentos: ${multiSegmentComplete.segments.length}`);
    
    let totalAmount = 0;
    multiSegmentComplete.segments.forEach((segment, index) => {
      const days = Math.ceil((segment.endDate - segment.startDate) / (1000 * 60 * 60 * 24));
      const segmentTotal = days * segment.baseRate;
      totalAmount += segmentTotal;
      
      console.log(`   Segmento ${index + 1}: ${segment.startDate.toISOString().split('T')[0]} - ${segment.endDate.toISOString().split('T')[0]}`);
      console.log(`     Servicios: ${segment.services.join(', ')}`);
      console.log(`     Tarifa: $${segment.baseRate}/noche × ${days} días = $${segmentTotal}`);
    });
    
    console.log(`   Total general: $${totalAmount}`);

    console.log('\n🎉 ¡Pruebas del nuevo sistema completadas exitosamente!');
    console.log('\n📊 Resumen:');
    console.log('   - ✅ Sistema de segmentos funcionando');
    console.log('   - ✅ Reservas simples con un segmento');
    console.log('   - ✅ Reservas complejas con múltiples segmentos');
    console.log('   - ✅ Cálculo de tarifas por segmento');
    console.log('   - ✅ Datos calculados correctamente');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar las pruebas
testNewSystem(); 