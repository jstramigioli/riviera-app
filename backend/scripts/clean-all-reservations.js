const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAllReservations() {
  try {
    console.log('🧹 Limpiando todas las reservas existentes...\n');

    // Obtener todas las reservas
    const reservations = await prisma.reservation.findMany({
      include: {
        segments: true,
        guests: true,
        nightRates: true
      }
    });

    console.log(`📊 Total de reservas a eliminar: ${reservations.length}`);

    let deletedReservations = 0;
    let deletedSegments = 0;
    let deletedGuests = 0;
    let deletedNightRates = 0;

    // Eliminar cada reserva y sus datos relacionados
    for (const reservation of reservations) {
      console.log(`🗑️ Eliminando reserva ${reservation.id}...`);
      
      // Eliminar night rates
      if (reservation.nightRates.length > 0) {
        await prisma.reservationNightRate.deleteMany({
          where: { reservationId: reservation.id }
        });
        deletedNightRates += reservation.nightRates.length;
      }

      // Eliminar huéspedes
      if (reservation.guests.length > 0) {
        await prisma.guest.deleteMany({
          where: { reservationId: reservation.id }
        });
        deletedGuests += reservation.guests.length;
      }

      // Eliminar segmentos
      if (reservation.segments.length > 0) {
        await prisma.reservationSegment.deleteMany({
          where: { reservationId: reservation.id }
        });
        deletedSegments += reservation.segments.length;
      }

      // Eliminar la reserva
      await prisma.reservation.delete({
        where: { id: reservation.id }
      });
      deletedReservations++;
    }

    console.log('\n✅ Limpieza completada!');
    console.log(`📊 Reservas eliminadas: ${deletedReservations}`);
    console.log(`📊 Segmentos eliminados: ${deletedSegments}`);
    console.log(`📊 Huéspedes eliminados: ${deletedGuests}`);
    console.log(`📊 Night rates eliminados: ${deletedNightRates}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAllReservations(); 