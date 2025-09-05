const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateReservationStatuses() {
  try {
    console.log('🔄 Actualizando estados de reservas...');
    
    // Mapeo de estados antiguos a nuevos
    const statusMapping = {
      'active': 'ingresada',
      'finished': 'finalizada', 
      'cancelled': 'cancelada',
      'confirmed': 'confirmada'
    };
    
    // Obtener todas las reservas
    const reservations = await prisma.reservation.findMany({
      select: { id: true, status: true }
    });
    
    console.log(`📊 Encontradas ${reservations.length} reservas`);
    
    let updatedCount = 0;
    
    for (const reservation of reservations) {
      const newStatus = statusMapping[reservation.status];
      
      if (newStatus) {
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: newStatus }
        });
        
        console.log(`✅ Reserva ${reservation.id}: ${reservation.status} → ${newStatus}`);
        updatedCount++;
      } else {
        console.log(`ℹ️  Reserva ${reservation.id}: ${reservation.status} (sin cambios)`);
      }
    }
    
    console.log(`\n🎉 Actualización completada: ${updatedCount} reservas actualizadas`);
    
  } catch (error) {
    console.error('❌ Error actualizando estados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateReservationStatuses();
