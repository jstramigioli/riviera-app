const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugRoom16Data() {
  try {
    console.log('=== DEBUG COMPLETO - HABITACIÓN 16 ===\n');

    // Obtener información de la habitación
    const room = await prisma.room.findUnique({
      where: { id: 16 },
      include: { roomType: true }
    });

    console.log(`Habitación: ${room.name} (ID: ${room.id})`);
    console.log(`Tipo: ${room.roomType.name}`);
    console.log(`Capacidad: ${room.roomType.maxPeople} personas\n`);

    // Obtener todas las reservas con segmentos en habitación 16
    const reservations = await prisma.reservation.findMany({
      where: {
        segments: {
          some: {
            roomId: 16
          }
        }
      },
      include: {
        mainClient: true,
        guests: true,
        segments: {
          where: { roomId: 16 },
          include: {
            room: true,
            roomType: true
          },
          orderBy: { startDate: 'asc' }
        }
      },
      orderBy: { id: 'asc' }
    });

    console.log(`Total de reservas encontradas: ${reservations.length}\n`);

    reservations.forEach((reservation, index) => {
      console.log(`=== RESERVA ${index + 1} (ID: ${reservation.id}) ===`);
      console.log(`Estado: ${reservation.status}`);
      console.log(`Check-in: ${reservation.checkIn}`);
      console.log(`Check-out: ${reservation.checkOut}`);
      console.log(`Notas: ${reservation.notes || 'Sin notas'}`);
      
      // Cliente principal
      console.log(`Cliente principal: ${reservation.mainClient ? JSON.stringify(reservation.mainClient, null, 2) : 'NULL'}`);
      
      // Huéspedes
      console.log(`Huéspedes (${reservation.guests.length}):`);
      reservation.guests.forEach((guest, gIndex) => {
        console.log(`  ${gIndex + 1}. Cliente ID: ${guest.clientId}`);
      });
      
      // Segmentos
      console.log(`Segmentos (${reservation.segments.length}):`);
      reservation.segments.forEach((segment, sIndex) => {
        console.log(`  ${sIndex + 1}. ${segment.startDate.toISOString().split('T')[0]} a ${segment.endDate.toISOString().split('T')[0]} - Habitación: ${segment.room.name} (Activo: ${segment.isActive})`);
      });
      
      console.log('');
    });

    // Verificar si hay clientes en la base de datos
    console.log('=== VERIFICACIÓN DE CLIENTES ===');
    const clients = await prisma.client.findMany({
      take: 5,
      orderBy: { id: 'asc' }
    });
    
    console.log(`Total de clientes en BD: ${await prisma.client.count()}`);
    console.log('Primeros 5 clientes:');
    clients.forEach((client, index) => {
      console.log(`  ${index + 1}. ID: ${client.id}, Nombre: ${client.name}, Email: ${client.email}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugRoom16Data(); 