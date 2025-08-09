const { PrismaClient } = require('@prisma/client');
const ReservationPricingService = require('../src/services/reservationPricingService');

const prisma = new PrismaClient();
const reservationPricingService = new ReservationPricingService(prisma);

async function migrateExistingReservations() {
  try {
    console.log('🚀 Iniciando migración de reservas existentes...');

    // Obtener todas las reservas que no tienen tarifas detalladas
    const reservations = await prisma.reservation.findMany({
      where: {
        nightRates: {
          none: {}
        }
      },
      include: {
        room: {
          include: {
            roomType: true
          }
        }
      }
    });

    console.log(`📊 Encontradas ${reservations.length} reservas para migrar`);

    let successCount = 0;
    let errorCount = 0;

    for (const reservation of reservations) {
      try {
        console.log(`🔄 Procesando reserva #${reservation.id}...`);

        // Determinar el tipo de servicio
        const serviceType = reservation.reservationType === 'con_desayuno' ? 'breakfast' : 
                           reservation.reservationType === 'media_pension' ? 'halfBoard' : 'base';

        // Calcular y almacenar tarifas detalladas
        const pricingResult = await reservationPricingService.calculateAndStoreNightRates(
          reservation.id,
          reservation.roomId,
          reservation.checkIn,
          reservation.checkOut,
          serviceType
        );

        console.log(`✅ Reserva #${reservation.id} migrada exitosamente`);
        console.log(`   - Noches procesadas: ${pricingResult.numberOfNights}`);
        console.log(`   - Total calculado: $${pricingResult.totalAmount.toFixed(2)}`);
        console.log(`   - Promedio por noche: $${(pricingResult.totalAmount / pricingResult.numberOfNights).toFixed(2)}`);

        successCount++;
      } catch (error) {
        console.error(`❌ Error migrando reserva #${reservation.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📈 Resumen de migración:');
    console.log(`✅ Reservas migradas exitosamente: ${successCount}`);
    console.log(`❌ Reservas con errores: ${errorCount}`);
    console.log(`📊 Total procesadas: ${successCount + errorCount}`);

    if (errorCount > 0) {
      console.log('\n⚠️  Algunas reservas no pudieron ser migradas. Revisa los errores arriba.');
    } else {
      console.log('\n🎉 ¡Migración completada exitosamente!');
    }

  } catch (error) {
    console.error('💥 Error general en la migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración si el script se ejecuta directamente
if (require.main === module) {
  migrateExistingReservations()
    .then(() => {
      console.log('✅ Script de migración completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error en el script de migración:', error);
      process.exit(1);
    });
}

module.exports = { migrateExistingReservations }; 