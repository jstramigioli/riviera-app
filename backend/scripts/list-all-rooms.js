const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAllRooms() {
  try {
    console.log('=== TODAS LAS HABITACIONES ===\n');

    const rooms = await prisma.room.findMany({
      include: { roomType: true },
      orderBy: { name: 'asc' }
    });

    console.log(`Total de habitaciones: ${rooms.length}\n`);

    rooms.forEach((room, index) => {
      console.log(`${index + 1}. Nombre: "${room.name}" (ID: ${room.id})`);
      console.log(`   - Tipo: ${room.roomType.name}`);
      console.log(`   - Capacidad: ${room.roomType.maxPeople} personas`);
      console.log(`   - Estado: ${room.status}`);
      console.log('');
    });

    // Mostrar habitaciones por ID también
    console.log('=== HABITACIONES POR ID ===\n');
    rooms.forEach((room, index) => {
      console.log(`ID ${room.id}: "${room.name}"`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listAllRooms(); 