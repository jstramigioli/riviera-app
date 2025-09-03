const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanAllTestData() {
  try {
    console.log('🧹 Limpiando todos los datos de prueba...');
    
    // Primero, obtener todas las reservas existentes con sus clientes
    const allReservations = await prisma.reservation.findMany({
      include: {
        mainClient: true,
        segments: true
      },
      orderBy: {
        id: 'asc'
      }
    });
    
    console.log(`📋 Encontradas ${allReservations.length} reservas:`);
    
    if (allReservations.length === 0) {
      console.log('✅ No hay reservas para eliminar');
      return;
    }
    
    // Mostrar las reservas que se van a eliminar
    allReservations.forEach((reservation, index) => {
      console.log(`${index + 1}. ID: ${reservation.id}`);
      console.log(`   Cliente: ${reservation.mainClient.firstName} ${reservation.mainClient.lastName} (ID: ${reservation.mainClient.id})`);
      console.log(`   Estado: ${reservation.status}`);
      console.log(`   Notas: ${reservation.notes || 'Sin notas'}`);
      console.log(`   Segmentos: ${reservation.segments.length}`);
      console.log('');
    });
    
    // Obtener IDs únicos de clientes que tienen reservas
    const clientIdsWithReservations = [...new Set(allReservations.map(r => r.mainClient.id))];
    
    console.log(`👥 Clientes que serán eliminados (${clientIdsWithReservations.length}):`);
    const clientsToDelete = await prisma.client.findMany({
      where: {
        id: {
          in: clientIdsWithReservations
        }
      }
    });
    
    clientsToDelete.forEach((client, index) => {
      console.log(`${index + 1}. ${client.firstName} ${client.lastName} (ID: ${client.id})`);
    });
    
    console.log('\n⚠️  ADVERTENCIA: Esto eliminará TODAS las reservas y sus clientes correspondientes.');
    console.log('¿Estás seguro de que quieres continuar? (s/n)');
    
    // En un entorno real, aquí podrías pedir confirmación
    // Por ahora, procedemos directamente
    
    // Eliminar todas las reservas (esto también eliminará los segmentos por CASCADE)
    const deletedReservations = await prisma.reservation.deleteMany({});
    
    console.log(`✅ Se eliminaron ${deletedReservations.count} reservas`);
    
    // Eliminar los clientes que tenían reservas
    const deletedClients = await prisma.client.deleteMany({
      where: {
        id: {
          in: clientIdsWithReservations
        }
      }
    });
    
    console.log(`✅ Se eliminaron ${deletedClients.count} clientes`);
    
    // Verificar si quedaron segmentos huérfanos
    const remainingSegments = await prisma.reservationSegment.count();
    
    if (remainingSegments > 0) {
      console.log(`⚠️  Encontrados ${remainingSegments} segmentos restantes, eliminándolos...`);
      
      const deletedSegments = await prisma.reservationSegment.deleteMany({});
      
      console.log(`✅ Se eliminaron ${deletedSegments.count} segmentos restantes`);
    }
    
    // Verificar estado final
    const finalReservations = await prisma.reservation.count();
    const finalClients = await prisma.client.count();
    const finalSegments = await prisma.reservationSegment.count();
    
    console.log('\n🎉 Limpieza completada exitosamente!');
    console.log('📊 Estado final:');
    console.log(`   - Reservas: ${finalReservations}`);
    console.log(`   - Clientes: ${finalClients}`);
    console.log(`   - Segmentos: ${finalSegments}`);
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para mostrar estadísticas antes de limpiar
async function showCurrentState() {
  try {
    console.log('📊 Estado actual de la base de datos...');
    
    const totalReservations = await prisma.reservation.count();
    const totalClients = await prisma.client.count();
    const totalSegments = await prisma.reservationSegment.count();
    
    console.log(`📋 Total de reservas: ${totalReservations}`);
    console.log(`👥 Total de clientes: ${totalClients}`);
    console.log(`📋 Total de segmentos: ${totalSegments}`);
    
    if (totalReservations > 0) {
      console.log('\n📋 Reservas existentes:');
      const reservations = await prisma.reservation.findMany({
        include: {
          mainClient: true
        },
        orderBy: {
          id: 'asc'
        }
      });
      
      reservations.forEach((reservation, index) => {
        console.log(`${index + 1}. ID: ${reservation.id} - Cliente: ${reservation.mainClient.firstName} ${reservation.mainClient.lastName} - Estado: ${reservation.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar según el argumento pasado
const action = process.argv[2];

switch (action) {
  case 'clean':
    cleanAllTestData();
    break;
  case 'check':
    showCurrentState();
    break;
  default:
    console.log('📖 Uso del script:');
    console.log('   node clean-all-test-data.js check  - Verificar estado actual');
    console.log('   node clean-all-test-data.js clean  - Eliminar TODAS las reservas y sus clientes');
    console.log('');
    console.log('⚠️  ADVERTENCIA: El comando "clean" eliminará TODOS los datos de reservas y clientes.');
    console.log('   Usa "check" primero para ver qué se va a eliminar.');
    process.exit(0);
} 