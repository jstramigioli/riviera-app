const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestSegmentedReservations() {
  try {
    console.log('🧪 Creando reservas de prueba con segmentos...\n');

    // Obtener habitaciones disponibles
    const rooms = await prisma.room.findMany({
      where: { status: 'available' },
      include: { roomType: true },
      orderBy: { name: 'asc' },
      take: 5
    });

    console.log(`📊 Habitaciones disponibles: ${rooms.length}`);

    // Obtener o crear cliente de prueba
    let client = await prisma.client.findFirst({
      where: { esFicticio: true }
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          firstName: 'Test',
          lastName: 'Cliente1',
          email: 'test.cliente1@ficticio.com',
          phone: '+54 11 1111-1111',
          documentType: 'DNI',
          documentNumber: '52486135',
          country: 'Argentina',
          province: 'Buenos Aires',
          city: 'CABA',
          notes: 'Cliente ficticio para testing - Generado automáticamente',
          wantsPromotions: true,
          esFicticio: true
        }
      });
    }

    // Crear reservas de prueba
    const testReservations = [
      {
        // Reserva simple con un segmento
        segments: [
          {
            roomId: rooms[0].id,
            startDate: '2025-09-15',
            endDate: '2025-09-20',
            baseRate: 100.0,
            guestCount: rooms[0].roomType.maxPeople || 2,
            services: ['con_desayuno'],
            reason: 'Reserva de prueba',
            notes: 'Segmento único'
          }
        ]
      },
      {
        // Reserva con dos segmentos consecutivos en la misma habitación
        segments: [
          {
            roomId: rooms[1].id,
            startDate: '2025-09-10',
            endDate: '2025-09-15',
            baseRate: 120.0,
            guestCount: rooms[1].roomType.maxPeople || 2,
            services: ['con_desayuno'],
            reason: 'Primer segmento',
            notes: 'Extensión de estadía'
          },
          {
            roomId: rooms[1].id,
            startDate: '2025-09-15',
            endDate: '2025-09-20',
            baseRate: 150.0,
            guestCount: rooms[1].roomType.maxPeople || 2,
            services: ['media_pension'],
            reason: 'Segundo segmento',
            notes: 'Cambio de plan'
          }
        ]
      },
      {
        // Reserva multi-habitación
        segments: [
          {
            roomId: rooms[2].id,
            startDate: '2025-09-12',
            endDate: '2025-09-18',
            baseRate: 200.0,
            guestCount: rooms[2].roomType.maxPeople || 2,
            services: ['con_desayuno'],
            reason: 'Habitación principal',
            notes: 'Primera habitación'
          },
          {
            roomId: rooms[3].id,
            startDate: '2025-09-12',
            endDate: '2025-09-18',
            baseRate: 180.0,
            guestCount: rooms[3].roomType.maxPeople || 2,
            services: ['con_desayuno'],
            reason: 'Habitación adicional',
            notes: 'Segunda habitación'
          }
        ]
      }
    ];

    let createdReservations = 0;

    for (const reservationData of testReservations) {
      try {
        // Crear la reserva
        const reservation = await prisma.reservation.create({
          data: {
            mainClientId: client.id,
            status: 'active',
            notes: 'Reserva de prueba con segmentos',
            isMultiRoom: reservationData.segments.length > 1
          }
        });

        // Crear los segmentos
        for (const segmentData of reservationData.segments) {
          await prisma.reservationSegment.create({
            data: {
              reservationId: reservation.id,
              roomId: segmentData.roomId,
              roomTypeId: rooms.find(r => r.id === segmentData.roomId)?.roomTypeId,
              startDate: new Date(segmentData.startDate),
              endDate: new Date(segmentData.endDate),
              services: segmentData.services,
              baseRate: segmentData.baseRate,
              guestCount: segmentData.guestCount,
              reason: segmentData.reason,
              notes: segmentData.notes,
              isActive: true
            }
          });
        }

        createdReservations++;
        console.log(`✅ Reserva ${createdReservations} creada (ID: ${reservation.id}) con ${reservationData.segments.length} segmentos`);

      } catch (error) {
        console.error(`❌ Error creando reserva ${createdReservations + 1}:`, error.message);
      }
    }

    console.log(`\n🎉 Proceso completado!`);
    console.log(`📊 Reservas creadas: ${createdReservations}`);

    // Verificar las reservas creadas
    const createdReservationsData = await prisma.reservation.findMany({
      where: { notes: 'Reserva de prueba con segmentos' },
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
      }
    });

    console.log(`\n📋 Verificación de reservas creadas:`);
    createdReservationsData.forEach((reservation, index) => {
      console.log(`   Reserva ${index + 1} (ID: ${reservation.id}):`);
      console.log(`     - Cliente: ${reservation.mainClient?.firstName} ${reservation.mainClient?.lastName}`);
      console.log(`     - Multi-habitación: ${reservation.isMultiRoom}`);
      console.log(`     - Segmentos: ${reservation.segments.length}`);
      reservation.segments.forEach((segment, segIndex) => {
        console.log(`       Segmento ${segIndex + 1}: ${segment.room.name} (${segment.startDate.toISOString().split('T')[0]} - ${segment.endDate.toISOString().split('T')[0]}) - $${segment.baseRate}`);
      });
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
createTestSegmentedReservations(); 