const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugVirtualRoomsAvailability() {
  try {
    console.log('🔍 Debuggeando disponibilidad de habitaciones virtuales...\n');

    // 1. Verificar habitaciones virtuales existentes
    console.log('1. Verificando habitaciones virtuales existentes...');
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

    console.log(`✅ Se encontraron ${virtualRooms.length} habitación(es) virtual(es)`);
    
    virtualRooms.forEach(vr => {
      console.log(`   • ${vr.name} (ID: ${vr.id})`);
      console.log(`     - Tipo: ${vr.roomType.name} (${vr.maxPeople} personas)`);
      console.log(`     - Activa: ${vr.isActive}`);
      console.log(`     - Componentes: ${vr.components.length} habitación(es)`);
      vr.components.forEach(comp => {
        console.log(`       * Hab ${comp.room.name} (ID: ${comp.roomId})`);
      });
    });

    // 2. Simular búsqueda para 4 personas
    console.log('\n2. Simulando búsqueda para 4 personas...');
    
    const checkIn = new Date();
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 3);

    console.log(`   Fechas: ${checkIn.toLocaleDateString()} - ${checkOut.toLocaleDateString()}`);

    // 3. Verificar habitaciones ocupadas
    console.log('\n3. Verificando habitaciones ocupadas...');
    const occupiedRooms = await prisma.reservationSegment.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                startDate: { lt: checkOut },
                endDate: { gt: checkIn }
              }
            ]
          },
          {
            isActive: true
          }
        ]
      },
      select: { roomId: true }
    });

    const occupiedRoomIds = occupiedRooms.map(r => r.roomId);
    console.log(`   Habitaciones ocupadas: ${occupiedRoomIds.length}`);
    if (occupiedRoomIds.length > 0) {
      console.log(`   IDs ocupados: ${occupiedRoomIds.join(', ')}`);
    }

    // 4. Verificar disponibilidad de habitaciones virtuales
    console.log('\n4. Verificando disponibilidad de habitaciones virtuales...');
    
    const availableVirtualRooms = virtualRooms.filter(virtualRoom => {
      const componentRoomIds = virtualRoom.components.map(comp => comp.roomId);
      const hasOccupiedComponent = componentRoomIds.some(roomId => occupiedRoomIds.includes(roomId));
      
      console.log(`   ${virtualRoom.name}:`);
      console.log(`     - Componentes: ${componentRoomIds.join(', ')}`);
      console.log(`     - Tiene componente ocupado: ${hasOccupiedComponent}`);
      console.log(`     - Disponible: ${!hasOccupiedComponent}`);
      
      return !hasOccupiedComponent;
    });

    console.log(`\n✅ Habitaciones virtuales disponibles: ${availableVirtualRooms.length}`);

    // 5. Verificar filtrado por capacidad
    console.log('\n5. Verificando filtrado por capacidad (4 personas)...');
    
    const capacityFilteredRooms = availableVirtualRooms.filter(room => room.maxPeople >= 4);
    
    console.log(`   Habitaciones con capacidad >= 4: ${capacityFilteredRooms.length}`);
    capacityFilteredRooms.forEach(room => {
      console.log(`     • ${room.name}: ${room.maxPeople} personas`);
    });

    // 6. Verificar formato final
    console.log('\n6. Verificando formato final...');
    
    const virtualRoomsFormatted = availableVirtualRooms.map(virtualRoom => ({
      id: `virtual_${virtualRoom.id}`,
      name: virtualRoom.name,
      description: virtualRoom.description,
      maxPeople: virtualRoom.maxPeople,
      status: 'available',
      isVirtual: true,
      roomType: virtualRoom.roomType,
      tags: [],
      components: virtualRoom.components,
      virtualRoomId: virtualRoom.id
    }));

    console.log(`   Habitaciones virtuales formateadas: ${virtualRoomsFormatted.length}`);
    virtualRoomsFormatted.forEach(room => {
      console.log(`     • ${room.name} (ID: ${room.id})`);
      console.log(`       - maxPeople: ${room.maxPeople}`);
      console.log(`       - isVirtual: ${room.isVirtual}`);
      console.log(`       - roomType: ${room.roomType.name}`);
    });

    // 7. Verificar habitaciones físicas para comparar
    console.log('\n7. Verificando habitaciones físicas disponibles...');
    
    const allAvailableRooms = await prisma.room.findMany({
      where: {
        id: { notIn: occupiedRoomIds },
        status: 'available'
      },
      include: {
        roomType: true,
        tags: true
      }
    });

    const physicalRoomsWithCapacity = allAvailableRooms.filter(room => room.maxPeople >= 4);
    
    console.log(`   Habitaciones físicas con capacidad >= 4: ${physicalRoomsWithCapacity.length}`);
    physicalRoomsWithCapacity.forEach(room => {
      console.log(`     • ${room.name}: ${room.maxPeople} personas (${room.roomType.name})`);
    });

    // 8. Resumen final
    console.log('\n📊 RESUMEN FINAL:');
    console.log(`   • Habitaciones virtuales totales: ${virtualRooms.length}`);
    console.log(`   • Habitaciones virtuales disponibles: ${availableVirtualRooms.length}`);
    console.log(`   • Habitaciones virtuales con capacidad >= 4: ${capacityFilteredRooms.length}`);
    console.log(`   • Habitaciones físicas con capacidad >= 4: ${physicalRoomsWithCapacity.length}`);
    console.log(`   • Total de opciones para 4 personas: ${capacityFilteredRooms.length + physicalRoomsWithCapacity.length}`);

    if (capacityFilteredRooms.length === 0) {
      console.log('\n❌ PROBLEMA DETECTADO: No hay habitaciones virtuales disponibles para 4 personas');
      console.log('   Posibles causas:');
      console.log('   1. No hay habitaciones virtuales configuradas');
      console.log('   2. Las habitaciones virtuales no tienen capacidad >= 4');
      console.log('   3. Los componentes están ocupados');
      console.log('   4. Las habitaciones virtuales no están activas');
    } else {
      console.log('\n✅ Habitaciones virtuales disponibles correctamente');
    }

  } catch (error) {
    console.error('❌ Error en el debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el debug
debugVirtualRoomsAvailability(); 