const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTagFiltering() {
  try {
    console.log('🧪 Probando sistema de filtrado por etiquetas...\n');

    // 1. Obtener todas las etiquetas disponibles
    console.log('📋 Etiquetas disponibles:');
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' }
    });
    
    tags.forEach(tag => {
      console.log(`  - ${tag.name} (ID: ${tag.id}, Color: ${tag.color})`);
    });

    // 2. Obtener todas las habitaciones con sus etiquetas
    console.log('\n🏨 Habitaciones y sus etiquetas:');
    const rooms = await prisma.room.findMany({
      include: {
        roomType: true,
        tags: true
      },
      orderBy: { name: 'asc' }
    });

    rooms.forEach(room => {
      const tagNames = room.tags.map(tag => tag.name).join(', ');
      console.log(`  - ${room.name} (${room.roomType.name}, ${room.maxPeople} pers.): [${tagNames || 'Sin etiquetas'}]`);
    });

    // 3. Simular búsquedas con diferentes etiquetas
    console.log('\n🔍 Simulando búsquedas con etiquetas:');

    // Simular parámetros de búsqueda
    const searchParams = {
      checkIn: '2025-01-15',
      checkOut: '2025-01-17',
      requiredGuests: 2
    };

    // Probar sin etiquetas
    console.log('\n  Búsqueda sin etiquetas:');
    const roomsWithoutTags = await prisma.room.findMany({
      where: {
        status: 'available',
        maxPeople: { gte: searchParams.requiredGuests }
      },
      include: {
        roomType: true,
        tags: true
      }
    });
    console.log(`    Habitaciones encontradas: ${roomsWithoutTags.length}`);

    // Probar con diferentes combinaciones de etiquetas
    if (tags.length > 0) {
      for (let i = 0; i < Math.min(3, tags.length); i++) {
        const selectedTag = tags[i];
        console.log(`\n  Búsqueda con etiqueta "${selectedTag.name}":`);
        
        const roomsWithTag = await prisma.room.findMany({
          where: {
            status: 'available',
            maxPeople: { gte: searchParams.requiredGuests },
            tags: {
              some: {
                id: selectedTag.id
              }
            }
          },
          include: {
            roomType: true,
            tags: true
          }
        });
        
        console.log(`    Habitaciones encontradas: ${roomsWithTag.length}`);
        roomsWithTag.forEach(room => {
          console.log(`      - ${room.name} (${room.roomType.name})`);
        });
      }

      // Probar con múltiples etiquetas si hay al menos 2
      if (tags.length >= 2) {
        const multipleTags = tags.slice(0, 2);
        console.log(`\n  Búsqueda con múltiples etiquetas (${multipleTags.map(t => t.name).join(', ')}):`);
        
        const roomsWithMultipleTags = await prisma.room.findMany({
          where: {
            status: 'available',
            maxPeople: { gte: searchParams.requiredGuests },
            tags: {
              some: {
                id: { in: multipleTags.map(t => t.id) }
              }
            }
          },
          include: {
            roomType: true,
            tags: true
          }
        });
        
        console.log(`    Habitaciones encontradas: ${roomsWithMultipleTags.length}`);
        roomsWithMultipleTags.forEach(room => {
          const roomTags = room.tags.map(t => t.name).join(', ');
          console.log(`      - ${room.name} (${room.roomType.name}): [${roomTags}]`);
        });
      }
    }

    // 4. Verificar habitaciones virtuales
    console.log('\n🏗️ Habitaciones virtuales:');
    const virtualRooms = await prisma.virtualRoom.findMany({
      where: { isActive: true },
      include: {
        roomType: true,
        components: {
          include: {
            room: {
              include: {
                tags: true
              }
            }
          }
        }
      }
    });

    virtualRooms.forEach(virtualRoom => {
      const componentTags = virtualRoom.components.flatMap(comp => 
        comp.room.tags.map(tag => tag.name)
      );
      const uniqueTags = [...new Set(componentTags)];
      console.log(`  - ${virtualRoom.name} (${virtualRoom.roomType.name}, ${virtualRoom.maxPeople} pers.): [${uniqueTags.join(', ') || 'Sin etiquetas'}]`);
    });

    console.log('\n✅ Prueba de filtrado por etiquetas completada');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la prueba
testTagFiltering(); 