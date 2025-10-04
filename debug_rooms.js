const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugRooms() {
  try {
    console.log('🔍 Verificando habitaciones en la base de datos...\n');
    
    // Verificar habitaciones físicas
    const rooms = await prisma.room.findMany({
      include: {
        roomType: true,
        tags: true
      }
    });
    
    console.log(`📊 Total de habitaciones físicas: ${rooms.length}`);
    
    if (rooms.length > 0) {
      console.log('\n🏨 Detalles de las habitaciones:');
      rooms.forEach((room, index) => {
        console.log(`${index + 1}. ${room.name} (ID: ${room.id})`);
        console.log(`   - Estado: ${room.status}`);
        console.log(`   - Capacidad: ${room.maxPeople} personas`);
        console.log(`   - Tipo: ${room.roomType?.name || 'Sin tipo'}`);
        console.log(`   - Etiquetas: ${room.tags.map(tag => tag.name).join(', ') || 'Sin etiquetas'}`);
        console.log('');
      });
    }
    
    // Verificar habitaciones virtuales
    const virtualRooms = await prisma.virtualRoom.findMany({
      include: {
        roomType: true,
        components: {
          include: {
            room: true
          }
        }
      }
    });
    
    console.log(`📊 Total de habitaciones virtuales: ${virtualRooms.length}`);
    
    if (virtualRooms.length > 0) {
      console.log('\n🏨 Detalles de las habitaciones virtuales:');
      virtualRooms.forEach((room, index) => {
        console.log(`${index + 1}. ${room.name} (ID: ${room.id})`);
        console.log(`   - Activa: ${room.isActive}`);
        console.log(`   - Capacidad: ${room.maxPeople} personas`);
        console.log(`   - Tipo: ${room.roomType?.name || 'Sin tipo'}`);
        console.log(`   - Componentes: ${room.components.length}`);
        console.log('');
      });
    }
    
    // Verificar tipos de habitación
    const roomTypes = await prisma.roomType.findMany();
    console.log(`📊 Total de tipos de habitación: ${roomTypes.length}`);
    
    if (roomTypes.length > 0) {
      console.log('\n🏨 Tipos de habitación:');
      roomTypes.forEach((type, index) => {
        console.log(`${index + 1}. ${type.name} (ID: ${type.id})`);
      });
    }
    
    // Verificar etiquetas
    const tags = await prisma.tag.findMany();
    console.log(`\n📊 Total de etiquetas: ${tags.length}`);
    
    if (tags.length > 0) {
      console.log('\n🏨 Etiquetas disponibles:');
      tags.forEach((tag, index) => {
        console.log(`${index + 1}. ${tag.name} (ID: ${tag.id})`);
      });
    }
    
    // Verificar reservas activas
    const activeReservations = await prisma.reservation.findMany({
      where: {
        status: {
          in: ['confirmed', 'checked-in']
        }
      },
      include: {
        segments: true
      }
    });
    
    console.log(`\n📊 Total de reservas activas: ${activeReservations.length}`);
    
    if (activeReservations.length > 0) {
      console.log('\n🏨 Reservas activas:');
      activeReservations.forEach((reservation, index) => {
        console.log(`${index + 1}. Reserva ${reservation.id} - ${reservation.status}`);
        console.log(`   - Segmentos: ${reservation.segments.length}`);
        if (reservation.segments.length > 0) {
          reservation.segments.forEach(segment => {
            console.log(`     * Habitación ${segment.roomId}: ${segment.startDate} a ${segment.endDate}`);
          });
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugRooms();

