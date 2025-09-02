const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVirtualRoomAvailability() {
  try {
    console.log('🔍 Verificando disponibilidad de habitaciones virtuales...\n');

    // 1. Buscar habitaciones virtuales
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

    if (virtualRooms.length === 0) {
      console.log('❌ No se encontraron habitaciones virtuales');
      console.log('💡 Ejecuta primero: node scripts/create-virtual-room-example.js');
      return;
    }

    console.log(`✅ Se encontraron ${virtualRooms.length} habitación(es) virtual(es)\n`);

    // 2. Verificar disponibilidad para cada habitación virtual
    for (const virtualRoom of virtualRooms) {
      console.log(`🏨 Habitación Virtual: ${virtualRoom.name}`);
      console.log(`   • Tipo: ${virtualRoom.roomType.name}`);
      console.log(`   • Capacidad: ${virtualRoom.maxPeople} personas`);
      console.log(`   • Componentes: ${virtualRoom.components.length} habitación(es) física(s)`);
      
      // Mostrar componentes
      virtualRoom.components.forEach((component, index) => {
        console.log(`     ${index + 1}. Hab ${component.room.name} (${component.room.maxPeople} personas)`);
      });

      // 3. Verificar disponibilidad para las próximas fechas
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // Verificar próximos 7 días

      console.log(`\n📅 Verificando disponibilidad del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}:`);

      const currentDate = new Date(startDate);
      let availableDays = 0;
      let blockedDays = 0;

      while (currentDate <= endDate) {
        const dateStr = currentDate.toLocaleDateString();
        
        // Verificar si alguna habitación física está ocupada
        const occupiedComponents = [];
        
        for (const component of virtualRoom.components) {
          // Verificar inventario individual
          const individualInventory = await prisma.roomInventory.findFirst({
            where: {
              roomId: component.room.id,
              virtualRoomId: null,
              date: currentDate,
              isAvailable: false
            }
          });

          // Verificar inventario virtual
          const virtualInventory = await prisma.roomInventory.findFirst({
            where: {
              roomId: component.room.id,
              virtualRoomId: virtualRoom.id,
              date: currentDate,
              isAvailable: false
            }
          });

          if (individualInventory || virtualInventory) {
            occupiedComponents.push(component.room.name);
          }
        }

        if (occupiedComponents.length > 0) {
          console.log(`   ❌ ${dateStr}: Ocupada (${occupiedComponents.join(', ')})`);
          blockedDays++;
        } else {
          console.log(`   ✅ ${dateStr}: Disponible`);
          availableDays++;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`\n📊 Resumen de disponibilidad:`);
      console.log(`   • Días disponibles: ${availableDays}`);
      console.log(`   • Días ocupados: ${blockedDays}`);
      console.log(`   • Porcentaje disponible: ${Math.round((availableDays / (availableDays + blockedDays)) * 100)}%`);
      
      console.log('\n' + '─'.repeat(60) + '\n');
    }

  } catch (error) {
    console.error('❌ Error al verificar disponibilidad:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para simular una reserva de habitación virtual
async function simulateVirtualRoomReservation() {
  try {
    console.log('🎯 Simulando reserva de habitación virtual...\n');

    // Buscar una habitación virtual
    const virtualRoom = await prisma.virtualRoom.findFirst({
      include: {
        components: {
          include: {
            room: true
          }
        }
      }
    });

    if (!virtualRoom) {
      console.log('❌ No se encontraron habitaciones virtuales');
      return;
    }

    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1); // Mañana
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 3); // 3 noches

    console.log(`🏨 Reservando: ${virtualRoom.name}`);
    console.log(`📅 Check-in: ${checkIn.toLocaleDateString()}`);
    console.log(`📅 Check-out: ${checkOut.toLocaleDateString()}`);

    // Verificar disponibilidad
    const currentDate = new Date(checkIn);
    let isAvailable = true;

    while (currentDate < checkOut && isAvailable) {
      for (const component of virtualRoom.components) {
        const inventory = await prisma.roomInventory.findFirst({
          where: {
            roomId: component.room.id,
            date: currentDate,
            isAvailable: false
          }
        });

        if (inventory) {
          isAvailable = false;
          break;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (!isAvailable) {
      console.log('❌ No disponible para las fechas seleccionadas');
      return;
    }

    console.log('✅ Disponible para reserva');

    // Simular bloqueo de inventario
    console.log('🔒 Bloqueando inventario...');
    
    const currentDate2 = new Date(checkIn);
    while (currentDate2 < checkOut) {
      for (const component of virtualRoom.components) {
        await prisma.roomInventory.upsert({
          where: {
            roomId_virtualRoomId_date: {
              roomId: component.room.id,
              virtualRoomId: virtualRoom.id,
              date: currentDate2
            }
          },
          update: {
            isAvailable: false,
            isBlocked: true,
            blockedReason: 'Reserva virtual'
          },
          create: {
            roomId: component.room.id,
            virtualRoomId: virtualRoom.id,
            date: currentDate2,
            isAvailable: false,
            isBlocked: true,
            blockedReason: 'Reserva virtual'
          }
        });
      }
      currentDate2.setDate(currentDate2.getDate() + 1);
    }

    console.log('✅ Inventario bloqueado exitosamente');
    console.log('💡 Ahora las habitaciones individuales no pueden ser reservadas para estas fechas');

  } catch (error) {
    console.error('❌ Error al simular reserva:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar verificaciones
async function main() {
  await checkVirtualRoomAvailability();
  console.log('\n' + '='.repeat(60) + '\n');
  await simulateVirtualRoomReservation();
}

main(); 