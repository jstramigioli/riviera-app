const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateTestReservations() {
  try {
    console.log('🚀 Iniciando generación de reservas de prueba para bloques activos...');
    
    // 1. Obtener todos los bloques activos
    const activeBlocks = await prisma.seasonBlock.findMany({
      where: {
        isActive: true,
        isDraft: false
      },
      include: {
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    });

    if (activeBlocks.length === 0) {
      console.log('⚠️  No se encontraron bloques activos. Creando un bloque de ejemplo...');
      
      // Crear un bloque de ejemplo
      const defaultBlock = await prisma.seasonBlock.create({
        data: {
          hotelId: 'default-hotel',
          name: 'Temporada de Prueba',
          description: 'Bloque creado para generar reservas de prueba',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
          isActive: true,
          useBlockServices: true,
          basePrice: 15000,
          isDraft: false
        }
      });
      
      console.log(`✅ Bloque de ejemplo creado: ${defaultBlock.id}`);
      activeBlocks.push(defaultBlock);
    }

    console.log(`📊 Encontrados ${activeBlocks.length} bloques activos`);

    // 2. Obtener habitaciones disponibles
    const rooms = await prisma.room.findMany({
      where: {
        status: 'available'
      },
      include: {
        roomType: true,
        tags: true
      },
      orderBy: {
        orderIndex: 'asc'
      }
    });

    if (rooms.length === 0) {
      console.log('❌ No se encontraron habitaciones disponibles');
      return;
    }

    console.log(`🏨 Encontradas ${rooms.length} habitaciones disponibles`);

    // 3. Obtener clientes existentes o crear algunos de prueba
    let clients = await prisma.client.findMany({
      where: {
        esFicticio: false
      },
      take: 10
    });

    if (clients.length < 5) {
      console.log('👥 Creando clientes de prueba adicionales...');
      const testClients = [
        {
          firstName: 'Ana',
          lastName: 'García',
          email: 'ana.garcia@test.com',
          phone: '+54 11 1111-1111',
          documentType: 'DNI',
          documentNumber: '11111111',
          country: 'Argentina',
          city: 'Buenos Aires',
          esFicticio: true
        },
        {
          firstName: 'Carlos',
          lastName: 'López',
          email: 'carlos.lopez@test.com',
          phone: '+54 11 2222-2222',
          documentType: 'DNI',
          documentNumber: '22222222',
          country: 'Argentina',
          city: 'Córdoba',
          esFicticio: true
        },
        {
          firstName: 'María',
          lastName: 'Fernández',
          email: 'maria.fernandez@test.com',
          phone: '+54 11 3333-3333',
          documentType: 'DNI',
          documentNumber: '33333333',
          country: 'Argentina',
          city: 'Rosario',
          esFicticio: true
        },
        {
          firstName: 'Pedro',
          lastName: 'Martínez',
          email: 'pedro.martinez@test.com',
          phone: '+54 11 4444-4444',
          documentType: 'DNI',
          documentNumber: '44444444',
          country: 'Argentina',
          city: 'Mendoza',
          esFicticio: true
        },
        {
          firstName: 'Laura',
          lastName: 'Rodríguez',
          email: 'laura.rodriguez@test.com',
          phone: '+54 11 5555-5555',
          documentType: 'DNI',
          documentNumber: '55555555',
          country: 'Argentina',
          city: 'La Plata',
          esFicticio: true
        }
      ];

      for (const clientData of testClients) {
        const newClient = await prisma.client.create({
          data: clientData
        });
        clients.push(newClient);
      }
      
      console.log(`✅ ${testClients.length} clientes de prueba creados`);
    }

    console.log(`👥 Total de clientes disponibles: ${clients.length}`);

    // 4. Generar reservas para cada bloque activo
    let totalReservationsCreated = 0;

    for (const block of activeBlocks) {
      console.log(`\n📅 Procesando bloque: ${block.name} (${block.startDate.toISOString().split('T')[0]} - ${block.endDate.toISOString().split('T')[0]})`);
      
      // Generar entre 3 y 8 reservas por bloque
      const reservationsToCreate = Math.floor(Math.random() * 6) + 3;
      console.log(`🎯 Generando ${reservationsToCreate} reservas para este bloque...`);

      for (let i = 0; i < reservationsToCreate; i++) {
        try {
          // Seleccionar cliente aleatorio
          const randomClient = clients[Math.floor(Math.random() * clients.length)];
          
          // Seleccionar habitación aleatoria
          const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
          
          // Generar fechas aleatorias dentro del bloque
          const blockStart = new Date(block.startDate);
          const blockEnd = new Date(block.endDate);
          const blockDuration = blockEnd.getTime() - blockStart.getTime();
          
          // Fecha de check-in aleatoria (primera mitad del bloque)
          const checkInTime = blockStart.getTime() + (Math.random() * blockDuration * 0.5);
          const checkIn = new Date(checkInTime);
          
          // Duración de estadía entre 1 y 5 noches
          const nights = Math.floor(Math.random() * 5) + 1;
          const checkOut = new Date(checkIn.getTime() + (nights * 24 * 60 * 60 * 1000));
          
          // Verificar que el check-out no exceda el final del bloque
          if (checkOut > blockEnd) {
            checkOut.setTime(blockEnd.getTime());
          }

          // Crear la reserva principal
          const reservation = await prisma.reservation.create({
            data: {
              mainClientId: randomClient.id,
              status: 'active',
              notes: `Reserva de prueba generada para bloque ${block.name}`,
              isMultiRoom: false
            }
          });

          // Crear el segmento de reserva
          const segment = await prisma.reservationSegment.create({
            data: {
              reservationId: reservation.id,
              startDate: checkIn,
              endDate: checkOut,
              roomId: randomRoom.id,
              roomTypeId: randomRoom.roomTypeId,
              services: ['breakfast'], // Servicio por defecto
              baseRate: block.basePrice || 15000, // Usar precio base del bloque o 15000 por defecto
              guestCount: Math.min(randomRoom.maxPeople, Math.floor(Math.random() * 3) + 1), // Entre 1 y la capacidad máxima
              notes: `Segmento generado automáticamente para ${randomRoom.name}`,
              isActive: true
            }
          });

          // Crear huéspedes para la reserva
          const guestCount = segment.guestCount;
          const guests = [];
          
          // El primer huésped es siempre el cliente principal
          guests.push({
            firstName: randomClient.firstName,
            lastName: randomClient.lastName,
            documentType: randomClient.documentType,
            documentNumber: randomClient.documentNumber,
            phone: randomClient.phone,
            email: randomClient.email,
            reservationId: reservation.id
          });

          // Crear huéspedes adicionales si es necesario
          for (let j = 1; j < guestCount; j++) {
            const guestNames = [
              { firstName: 'Juan', lastName: 'Pérez' },
              { firstName: 'María', lastName: 'González' },
              { firstName: 'Carlos', lastName: 'López' },
              { firstName: 'Ana', lastName: 'Martínez' },
              { firstName: 'Luis', lastName: 'Fernández' }
            ];
            
            const randomGuest = guestNames[Math.floor(Math.random() * guestNames.length)];
            
            guests.push({
              firstName: randomGuest.firstName,
              lastName: randomGuest.lastName,
              documentType: 'DNI',
              documentNumber: `${Math.floor(Math.random() * 90000000) + 10000000}`, // DNI aleatorio
              reservationId: reservation.id
            });
          }

          // Crear los huéspedes en la base de datos
          for (const guestData of guests) {
            await prisma.guest.create({
              data: guestData
            });
          }

          totalReservationsCreated++;
          console.log(`  ✅ Reserva ${totalReservationsCreated}: ${randomClient.firstName} ${randomClient.lastName} - ${randomRoom.name} (${checkIn.toISOString().split('T')[0]} a ${checkOut.toISOString().split('T')[0]}) - ${guests.length} huéspedes`);

        } catch (error) {
          console.error(`  ❌ Error creando reserva ${i + 1} para bloque ${block.name}:`, error.message);
        }
      }
    }

    console.log(`\n🎉 ¡Proceso completado!`);
    console.log(`📊 Resumen:`);
    console.log(`   • Bloques procesados: ${activeBlocks.length}`);
    console.log(`   • Reservas creadas: ${totalReservationsCreated}`);
    console.log(`   • Clientes utilizados: ${clients.length}`);
    console.log(`   • Habitaciones utilizadas: ${rooms.length}`);

    // 5. Mostrar estadísticas finales
    const finalReservations = await prisma.reservation.count();
    const finalGuests = await prisma.guest.count();
    const finalSegments = await prisma.reservationSegment.count();
    
    console.log(`\n📈 Estado actual de la base de datos:`);
    console.log(`   • Total de reservas: ${finalReservations}`);
    console.log(`   • Total de huéspedes: ${finalGuests}`);
    console.log(`   • Total de segmentos: ${finalSegments}`);

  } catch (error) {
    console.error('❌ Error durante la generación de reservas:', error);
    throw error;
  }
}

// Función para limpiar reservas de prueba (opcional)
async function cleanupTestReservations() {
  try {
    console.log('🧹 Limpiando reservas de prueba...');
    
    // Obtener IDs de clientes ficticios
    const ficticiousClients = await prisma.client.findMany({
      where: { esFicticio: true },
      select: { id: true }
    });
    
    const ficticiousClientIds = ficticiousClients.map(c => c.id);
    
    if (ficticiousClientIds.length === 0) {
      console.log('⚠️  No se encontraron clientes ficticios para limpiar');
      return;
    }

    // Obtener reservas de clientes ficticios
    const testReservations = await prisma.reservation.findMany({
      where: {
        mainClientId: { in: ficticiousClientIds }
      },
      select: { id: true }
    });

    const reservationIds = testReservations.map(r => r.id);

    if (reservationIds.length === 0) {
      console.log('⚠️  No se encontraron reservas de prueba para limpiar');
      return;
    }

    // Eliminar en orden para respetar las relaciones
    await prisma.reservationNightRate.deleteMany({
      where: { reservationId: { in: reservationIds } }
    });
    
    await prisma.guest.deleteMany({
      where: { reservationId: { in: reservationIds } }
    });
    
    await prisma.reservationSegment.deleteMany({
      where: { reservationId: { in: reservationIds } }
    });
    
    await prisma.reservation.deleteMany({
      where: { id: { in: reservationIds } }
    });
    
    await prisma.client.deleteMany({
      where: { id: { in: ficticiousClientIds } }
    });

    console.log(`✅ Limpieza completada: ${reservationIds.length} reservas y ${ficticiousClientIds.length} clientes eliminados`);

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    throw error;
  }
}

// Ejecutar el script
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    await cleanupTestReservations();
  } else {
    await generateTestReservations();
  }
}

main()
  .catch((error) => {
    console.error('Error ejecutando el script:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
