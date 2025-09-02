const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createVirtualRoomExample() {
  try {
    console.log('🏗️ Creando ejemplo de habitación virtual conectable...\n');

    // 1. Buscar las habitaciones físicas (ejemplo: Hab 8 y Hab 9)
    const room8 = await prisma.room.findFirst({
      where: { name: '8' }
    });

    const room9 = await prisma.room.findFirst({
      where: { name: '9' }
    });

    if (!room8 || !room9) {
      console.log('❌ No se encontraron las habitaciones 8 y 9');
      console.log('💡 Asegúrate de que existan estas habitaciones en la base de datos');
      return;
    }

    console.log(`✅ Habitación 8 encontrada: ${room8.name} (${room8.maxPeople} personas)`);
    console.log(`✅ Habitación 9 encontrada: ${room9.name} (${room9.maxPeople} personas)`);

    // 2. Buscar o crear un tipo de habitación para cuádruple
    let quadrupleRoomType = await prisma.roomType.findFirst({
      where: { name: 'Cuádruple' }
    });

    if (!quadrupleRoomType) {
      console.log('📝 Creando tipo de habitación Cuádruple...');
      quadrupleRoomType = await prisma.roomType.create({
        data: {
          name: 'Cuádruple',
          description: 'Habitación para 4 personas',
          orderIndex: 10
        }
      });
      console.log(`✅ Tipo de habitación creado: ${quadrupleRoomType.name}`);
    }

    // 3. Crear la habitación virtual
    console.log('🏗️ Creando habitación virtual conectable...');
    const virtualRoom = await prisma.virtualRoom.create({
      data: {
        name: 'Suite Conectable 8-9',
        description: 'Habitación conectable formada por Hab 8 y Hab 9',
        maxPeople: room8.maxPeople + room9.maxPeople, // 4 personas total
        roomTypeId: quadrupleRoomType.id,
        orderIndex: 1
      }
    });

    console.log(`✅ Habitación virtual creada: ${virtualRoom.name} (${virtualRoom.maxPeople} personas)`);

    // 4. Conectar las habitaciones físicas con la virtual
    console.log('🔗 Conectando habitaciones físicas...');
    
    await prisma.virtualRoomComponent.create({
      data: {
        virtualRoomId: virtualRoom.id,
        roomId: room8.id,
        isRequired: true,
        orderIndex: 1
      }
    });

    await prisma.virtualRoomComponent.create({
      data: {
        virtualRoomId: virtualRoom.id,
        roomId: room9.id,
        isRequired: true,
        orderIndex: 2
      }
    });

    console.log('✅ Habitaciones conectadas exitosamente');

    // 5. Crear inventario para las próximas fechas
    console.log('📅 Creando inventario para las próximas fechas...');
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 días de inventario

    const inventoryEntries = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Inventario para habitación individual 8
      inventoryEntries.push({
        roomId: room8.id,
        virtualRoomId: null,
        date: new Date(currentDate),
        isAvailable: true,
        isBlocked: false
      });

      // Inventario para habitación individual 9
      inventoryEntries.push({
        roomId: room9.id,
        virtualRoomId: null,
        date: new Date(currentDate),
        isAvailable: true,
        isBlocked: false
      });

      // Inventario para habitación virtual (conectable)
      inventoryEntries.push({
        roomId: room8.id, // Usar room8 como referencia principal
        virtualRoomId: virtualRoom.id,
        date: new Date(currentDate),
        isAvailable: true,
        isBlocked: false
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Insertar inventario en lotes
    await prisma.roomInventory.createMany({
      data: inventoryEntries,
      skipDuplicates: true
    });

    console.log(`✅ Inventario creado para ${inventoryEntries.length / 3} días`);

    // 6. Mostrar resumen
    console.log('\n🎉 ¡Ejemplo de habitación virtual creado exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`   • Habitación Virtual: ${virtualRoom.name}`);
    console.log(`   • Capacidad: ${virtualRoom.maxPeople} personas`);
    console.log(`   • Habitaciones físicas: ${room8.name} + ${room9.name}`);
    console.log(`   • Tipo: ${quadrupleRoomType.name}`);
    console.log(`   • Inventario: 30 días creado`);
    
    console.log('\n💡 Cómo funciona:');
    console.log('   1. Cuando se reserva la habitación virtual, se bloquean ambas habitaciones físicas');
    console.log('   2. Cuando se reserva una habitación individual, se bloquea la habitación virtual');
    console.log('   3. El sistema previene conflictos automáticamente');

  } catch (error) {
    console.error('❌ Error al crear el ejemplo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
createVirtualRoomExample(); 