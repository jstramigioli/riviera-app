const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateToSegments() {
  try {
    console.log('🔄 Iniciando migración al sistema de segmentos...\n');

    // 1. Limpiar segmentos existentes (datos de prueba)
    console.log('📋 1. Limpiando segmentos existentes...');
    await prisma.reservationSegment.deleteMany({});
    console.log('✅ Segmentos existentes eliminados');

    // 2. Obtener todas las reservas existentes
    console.log('\n📋 2. Obteniendo reservas existentes...');
    const reservations = await prisma.reservation.findMany({
      include: {
        mainClient: true,
        room: true
      }
    });
    console.log(`✅ ${reservations.length} reservas encontradas`);

    // 3. Crear segmentos para cada reserva
    console.log('\n📋 3. Creando segmentos para cada reserva...');
    
    for (const reservation of reservations) {
      console.log(`   Procesando reserva ${reservation.id}...`);
      
      // Calcular días de estadía
      const checkIn = new Date(reservation.checkIn);
      const checkOut = new Date(reservation.checkOut);
      const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const baseRate = reservation.totalAmount / days;

      // Crear segmento inicial
      await prisma.reservationSegment.create({
        data: {
          reservationId: reservation.id,
          startDate: checkIn,
          endDate: checkOut,
          roomId: reservation.roomId,
          services: [reservation.reservationType || 'con_desayuno'],
          baseRate: baseRate,
          guestCount: reservation.requiredGuests || 1,
          reason: 'Migración inicial',
          notes: `Segmento inicial creado durante migración - Reserva original: ${reservation.id}`
        }
      });
      
      console.log(`   ✅ Segmento creado para reserva ${reservation.id}`);
    }

    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log(`📊 Total de segmentos creados: ${reservations.length}`);

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración
migrateToSegments(); 