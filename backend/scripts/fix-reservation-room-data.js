const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixReservationRoomData() {
  try {
    console.log('🔍 Verificando reservas sin información de habitación...');
    
    // Obtener todas las reservas
    const reservations = await prisma.reservation.findMany({
      include: {
        segments: {
          where: { isActive: true },
          include: {
            room: true
          }
        }
      }
    });
    
    console.log(`📊 Total de reservas encontradas: ${reservations.length}`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const reservation of reservations) {
      try {
        // Verificar si la reserva tiene segmentos activos
        if (!reservation.segments || reservation.segments.length === 0) {
          console.log(`⚠️  Reserva ${reservation.id}: No tiene segmentos activos`);
          errorCount++;
          continue;
        }
        
        const firstSegment = reservation.segments[0];
        
        if (!firstSegment.room) {
          console.log(`⚠️  Reserva ${reservation.id}: Segmento ${firstSegment.id} no tiene información de habitación`);
          errorCount++;
          continue;
        }
        
        console.log(`✅ Reserva ${reservation.id}: Habitación ${firstSegment.room.name} (ID: ${firstSegment.room.id})`);
        fixedCount++;
        
      } catch (error) {
        console.error(`❌ Error procesando reserva ${reservation.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Resumen:');
    console.log(`✅ Reservas procesadas correctamente: ${fixedCount}`);
    console.log(`⚠️  Reservas con problemas: ${errorCount}`);
    console.log(`📊 Total: ${reservations.length}`);
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
fixReservationRoomData(); 