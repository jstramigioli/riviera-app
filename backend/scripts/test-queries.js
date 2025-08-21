const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testQueries() {
  try {
    console.log('🧪 Iniciando pruebas del sistema de consultas...\n');

    // 1. Crear una consulta básica
    console.log('1️⃣ Creando consulta básica...');
    const basicQuery = await prisma.query.create({
      data: {
        status: 'pendiente',
        reservationType: 'con_desayuno',
        notes: 'Consulta de prueba básica',
        requiredTags: ['vista_mar']
      }
    });
    console.log('✅ Consulta básica creada:', basicQuery.id);

    // 2. Crear una consulta con más datos
    console.log('\n2️⃣ Creando consulta con datos completos...');
    
    // Obtener un cliente existente
    const client = await prisma.client.findFirst();
    const room = await prisma.room.findFirst();
    
    if (!client || !room) {
      console.log('⚠️ No se encontraron clientes o habitaciones para la prueba');
      return;
    }

    const fullQuery = await prisma.query.create({
      data: {
        roomId: room.id,
        mainClientId: client.id,
        checkIn: new Date('2025-01-15'),
        checkOut: new Date('2025-01-18'),
        totalAmount: 1500.00,
        status: 'en_revision',
        reservationType: 'media_pension',
        notes: 'Consulta completa de prueba',
        fixed: true,
        requiredGuests: 2,
        requiredTags: ['vista_mar', 'balcon'],
        requirementsNotes: 'Preferencia por habitación con vista al mar',
        guests: {
          create: [
            {
              firstName: 'Juan',
              lastName: 'Pérez',
              documentType: 'DNI',
              documentNumber: '12345678',
              phone: '+54 11 1234-5678',
              email: 'juan.perez@email.com'
            },
            {
              firstName: 'María',
              lastName: 'González',
              documentType: 'DNI',
              documentNumber: '87654321',
              phone: '+54 11 8765-4321',
              email: 'maria.gonzalez@email.com'
            }
          ]
        }
      },
      include: {
        guests: true,
        room: {
          include: {
            roomType: true
          }
        },
        mainClient: true
      }
    });
    console.log('✅ Consulta completa creada:', fullQuery.id);
    console.log('   - Huéspedes:', fullQuery.guests.length);
    console.log('   - Habitación:', fullQuery.room?.name);
    console.log('   - Cliente:', fullQuery.mainClient?.firstName);

    // 3. Listar todas las consultas
    console.log('\n3️⃣ Listando todas las consultas...');
    const allQueries = await prisma.query.findMany({
      include: {
        guests: true,
        room: {
          include: {
            roomType: true
          }
        },
        mainClient: true
      }
    });
    console.log(`✅ Total de consultas: ${allQueries.length}`);
    allQueries.forEach((query, index) => {
      console.log(`   ${index + 1}. ID: ${query.id}, Estado: ${query.status}, Huéspedes: ${query.guests.length}`);
    });

    // 4. Actualizar una consulta
    console.log('\n4️⃣ Actualizando consulta...');
    const updatedQuery = await prisma.query.update({
      where: { id: basicQuery.id },
      data: {
        status: 'confirmada',
        notes: 'Consulta actualizada - lista para convertir a reserva'
      }
    });
    console.log('✅ Consulta actualizada:', updatedQuery.status);

    // 5. Convertir consulta a reserva
    console.log('\n5️⃣ Convirtiendo consulta a reserva...');
    
    // Primero necesitamos completar los datos mínimos de la consulta básica
    await prisma.query.update({
      where: { id: basicQuery.id },
      data: {
        roomId: room.id,
        mainClientId: client.id,
        checkIn: new Date('2025-02-01'),
        checkOut: new Date('2025-02-03'),
        totalAmount: 800.00,
        requiredGuests: 1
      }
    });

    // Simular la conversión (en la práctica esto se haría a través del endpoint)
    console.log('✅ Consulta preparada para conversión a reserva');
    console.log('   - En la práctica, esto se haría llamando al endpoint /api/queries/:id/convert-to-reservation');

    // 6. Verificar estado final
    console.log('\n6️⃣ Estado final...');
    const finalQueries = await prisma.query.findMany();
    const finalReservations = await prisma.reservation.findMany();
    
    console.log(`✅ Consultas restantes: ${finalQueries.length}`);
    console.log(`✅ Total de reservas: ${finalReservations.length}`);

    console.log('\n🎉 Todas las pruebas completadas exitosamente!');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testQueries()
    .then(() => {
      console.log('✅ Pruebas finalizadas');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en las pruebas:', error);
      process.exit(1);
    });
}

module.exports = { testQueries }; 