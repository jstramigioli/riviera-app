const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixVirtualRoomCapacity() {
  try {
    console.log('🔧 Corrigiendo capacidad de habitaciones virtuales...\n');

    // Obtener todas las habitaciones virtuales
    const virtualRooms = await prisma.virtualRoom.findMany({
      include: {
        components: {
          include: {
            room: true
          }
        },
        roomType: true
      }
    });

    console.log(`📋 Se encontraron ${virtualRooms.length} habitación(es) virtual(es) para corregir\n`);

    for (const virtualRoom of virtualRooms) {
      console.log(`🏗️ Procesando: ${virtualRoom.name}`);
      console.log(`   Capacidad actual: ${virtualRoom.maxPeople} personas`);
      console.log(`   Tipo asignado: ${virtualRoom.roomType.name}`);
      
      // Calcular la capacidad total sumando las capacidades de los componentes
      const totalCapacity = virtualRoom.components.reduce((sum, component) => {
        console.log(`     Componente: Hab ${component.room.name} (${component.room.maxPeople} personas)`);
        return sum + component.room.maxPeople;
      }, 0);

      console.log(`   Capacidad calculada: ${totalCapacity} personas`);

      if (totalCapacity !== virtualRoom.maxPeople) {
        console.log(`   ⚠️  Capacidad incorrecta. Actualizando...`);
        
        // Actualizar la capacidad
        await prisma.virtualRoom.update({
          where: { id: virtualRoom.id },
          data: { maxPeople: totalCapacity }
        });

        console.log(`   ✅ Capacidad actualizada a ${totalCapacity} personas`);
      } else {
        console.log(`   ✅ Capacidad correcta`);
      }
      
      console.log('');
    }

    console.log('🎉 Proceso completado. Verificando resultados...\n');

    // Verificar los resultados
    const updatedVirtualRooms = await prisma.virtualRoom.findMany({
      include: {
        components: {
          include: {
            room: true
          }
        },
        roomType: true
      }
    });

    console.log('📊 RESULTADOS FINALES:');
    updatedVirtualRooms.forEach(vr => {
      console.log(`   • ${vr.name}: ${vr.maxPeople} personas (${vr.roomType.name})`);
      console.log(`     Componentes: ${vr.components.map(c => `Hab ${c.room.name} (${c.room.maxPeople})`).join(', ')}`);
    });

  } catch (error) {
    console.error('❌ Error corrigiendo capacidad:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
fixVirtualRoomCapacity(); 