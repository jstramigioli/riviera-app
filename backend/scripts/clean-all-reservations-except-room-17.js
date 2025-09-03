const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAllReservationsExceptRoom17() {
  console.log('=== LIMPIEZA DE RESERVAS - MANTENER SOLO HABITACIÓN 17 ===');

  try {
    // Primero, obtener todas las reservas que NO son de la habitación 17
    const reservationsToDelete = await prisma.reservation.findMany({
      where: {
        segments: {
          none: {
            roomId: 16 // ID de la habitación 17
          }
        }
      },
      include: {
        segments: {
          include: {
            room: true
          }
        },
        mainClient: true
      }
    });

    console.log(`\nReservas a eliminar: ${reservationsToDelete.length}`);

    if (reservationsToDelete.length > 0) {
      console.log('\nDetalles de las reservas que se eliminarán:');
      reservationsToDelete.forEach((reservation, index) => {
        console.log(`${index + 1}. Reserva ID: ${reservation.id}`);
        console.log(`   Cliente: ${reservation.mainClient.firstName} ${reservation.mainClient.lastName}`);
        console.log(`   Estado: ${reservation.status}`);
        console.log(`   Segmentos:`);
        reservation.segments.forEach(segment => {
          console.log(`     - Habitación: ${segment.room.name} (${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]})`);
        });
      });

      // Confirmar antes de eliminar
      console.log('\n⚠️  ¿Estás seguro de que quieres eliminar estas reservas?');
      console.log('   Esto eliminará permanentemente todas las reservas excepto las de la habitación 17.');
      
      // En un script automatizado, procedemos directamente
      console.log('\n🔄 Procediendo con la eliminación...');

      // Eliminar en orden: primero los segmentos, luego las reservas
      for (const reservation of reservationsToDelete) {
        // Eliminar segmentos de la reserva
        await prisma.reservationSegment.deleteMany({
          where: { reservationId: reservation.id }
        });

        // Eliminar huéspedes de la reserva
        await prisma.guest.deleteMany({
          where: { reservationId: reservation.id }
        });

        // Eliminar tarifas por noche de la reserva
        await prisma.reservationNightRate.deleteMany({
          where: { reservationId: reservation.id }
        });

        // Eliminar la reserva
        await prisma.reservation.delete({
          where: { id: reservation.id }
        });

        console.log(`✅ Eliminada reserva ${reservation.id}`);
      }

      console.log('\n🎉 Eliminación completada exitosamente');
    } else {
      console.log('\n✅ No hay reservas para eliminar (todas son de la habitación 17)');
    }

    // Ahora listar las reservas que quedaron
    console.log('\n=== RESERVAS RESTANTES ===');
    
    const remainingReservations = await prisma.reservation.findMany({
      include: {
        segments: {
          include: {
            room: true
          },
          orderBy: {
            startDate: 'asc'
          }
        },
        mainClient: true
      },
      orderBy: {
        id: 'asc'
      }
    });

    console.log(`Total de reservas restantes: ${remainingReservations.length}`);

    if (remainingReservations.length > 0) {
      remainingReservations.forEach((reservation, index) => {
        console.log(`\n--- RESERVA ${index + 1} ---`);
        console.log(`ID: ${reservation.id}`);
        console.log(`Cliente: ${reservation.mainClient.firstName} ${reservation.mainClient.lastName}`);
        console.log(`Estado: ${reservation.status}`);
        console.log(`Segmentos:`);
        
        reservation.segments.forEach((segment, segIndex) => {
          console.log(`  ${segIndex + 1}. Habitación: ${segment.room.name} (ID: ${segment.room.id})`);
          console.log(`     Fechas: ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]}`);
          console.log(`     Activo: ${segment.isActive}`);
        });
      });
    } else {
      console.log('❌ No quedaron reservas en la base de datos');
    }

  } catch (error) {
    console.error('Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAllReservationsExceptRoom17(); 