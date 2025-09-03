const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Patrones de notas que identifican reservas ficticias
const FAKE_RESERVATION_NOTES = [
  'Cliente ficticio para pruebas',
  'Testing - Reserva automática',
  'Testing del sistema de reservas',
  'Reserva de prueba - Cliente ficticio',
  'Reserva generada automáticamente',
  'Segmento de reserva ficticia para testing'
];

async function cleanFakeReservations() {
  try {
    console.log('🧹 Limpiando reservas ficticias...');
    
    // Buscar reservas con notas que indiquen que son ficticias
    const fakeReservations = await prisma.reservation.findMany({
      where: {
        OR: [
          {
            notes: {
              in: FAKE_RESERVATION_NOTES
            }
          },
          {
            notes: {
              contains: 'Testing'
            }
          },
          {
            notes: {
              contains: 'ficticio'
            }
          },
          {
            notes: {
              contains: 'prueba'
            }
          }
        ]
      },
      include: {
        mainClient: true,
        segments: true
      }
    });
    
    console.log(`📋 Encontradas ${fakeReservations.length} reservas ficticias:`);
    
    if (fakeReservations.length === 0) {
      console.log('✅ No hay reservas ficticias para eliminar');
      return;
    }
    
    // Mostrar las reservas que se van a eliminar
    fakeReservations.forEach((reservation, index) => {
      console.log(`${index + 1}. ID: ${reservation.id}`);
      console.log(`   Cliente: ${reservation.mainClient.firstName} ${reservation.mainClient.lastName}`);
      console.log(`   Estado: ${reservation.status}`);
      console.log(`   Notas: ${reservation.notes}`);
      console.log(`   Segmentos: ${reservation.segments.length}`);
      console.log('');
    });
    
    // Eliminar las reservas (esto también eliminará los segmentos por CASCADE)
    const deletedReservations = await prisma.reservation.deleteMany({
      where: {
        OR: [
          {
            notes: {
              in: FAKE_RESERVATION_NOTES
            }
          },
          {
            notes: {
              contains: 'Testing'
            }
          },
          {
            notes: {
              contains: 'ficticio'
            }
          },
          {
            notes: {
              contains: 'prueba'
            }
          }
        ]
      }
    });
    
    console.log(`✅ Se eliminaron ${deletedReservations.count} reservas ficticias`);
    
    // Verificar si quedaron segmentos huérfanos (segmentos sin reserva válida)
    const allSegments = await prisma.reservationSegment.findMany({
      include: {
        reservation: true
      }
    });
    
    const orphanSegments = allSegments.filter(segment => !segment.reservation);
    
    if (orphanSegments.length > 0) {
      console.log(`⚠️  Encontrados ${orphanSegments.length} segmentos huérfanos, eliminándolos...`);
      
      const orphanSegmentIds = orphanSegments.map(segment => segment.id);
      
      const deletedSegments = await prisma.reservationSegment.deleteMany({
        where: {
          id: {
            in: orphanSegmentIds
          }
        }
      });
      
      console.log(`✅ Se eliminaron ${deletedSegments.count} segmentos huérfanos`);
    }
    
    console.log('🎉 Limpieza completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para mostrar estadísticas rápidas
async function showStats() {
  try {
    console.log('📊 Estadísticas de reservas...');
    
    const totalReservations = await prisma.reservation.count();
    const totalSegments = await prisma.reservationSegment.count();
    
    const fakeReservations = await prisma.reservation.count({
      where: {
        OR: [
          {
            notes: {
              in: FAKE_RESERVATION_NOTES
            }
          },
          {
            notes: {
              contains: 'Testing'
            }
          },
          {
            notes: {
              contains: 'ficticio'
            }
          },
          {
            notes: {
              contains: 'prueba'
            }
          }
        ]
      }
    });
    
    console.log(`📋 Total de reservas: ${totalReservations}`);
    console.log(`📋 Total de segmentos: ${totalSegments}`);
    console.log(`🎭 Reservas ficticias: ${fakeReservations}`);
    console.log(`✅ Reservas reales: ${totalReservations - fakeReservations}`);
    
    if (fakeReservations > 0) {
      console.log(`\n⚠️  Hay ${fakeReservations} reservas ficticias. Usa 'clean' para eliminarlas.`);
    } else {
      console.log(`\n✅ No hay reservas ficticias en la base de datos.`);
    }
    
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para listar reservas ficticias sin eliminarlas
async function listFakeReservations() {
  try {
    console.log('📋 Listando reservas ficticias...');
    
    const fakeReservations = await prisma.reservation.findMany({
      where: {
        OR: [
          {
            notes: {
              in: FAKE_RESERVATION_NOTES
            }
          },
          {
            notes: {
              contains: 'Testing'
            }
          },
          {
            notes: {
              contains: 'ficticio'
            }
          },
          {
            notes: {
              contains: 'prueba'
            }
          }
        ]
      },
      include: {
        mainClient: true,
        segments: true
      },
      orderBy: {
        id: 'desc'
      }
    });
    
    if (fakeReservations.length === 0) {
      console.log('ℹ️  No hay reservas ficticias en la base de datos');
      return;
    }
    
    console.log(`\n📊 Total de reservas ficticias: ${fakeReservations.length}`);
    console.log('\n📋 Lista de reservas ficticias:');
    
    fakeReservations.forEach((reservation, index) => {
      console.log(`${index + 1}. ID: ${reservation.id}`);
      console.log(`   Cliente: ${reservation.mainClient.firstName} ${reservation.mainClient.lastName}`);
      console.log(`   Estado: ${reservation.status}`);
      console.log(`   Notas: ${reservation.notes}`);
      console.log(`   Segmentos: ${reservation.segments.length}`);
      console.log(`   Creada: ${reservation.createdAt.toLocaleDateString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error al listar reservas ficticias:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar según el argumento pasado
const action = process.argv[2];

switch (action) {
  case 'clean':
    cleanFakeReservations();
    break;
  case 'list':
    listFakeReservations();
    break;
  case 'stats':
    showStats();
    break;
  default:
    console.log('📖 Uso del script:');
    console.log('   node clean-fake-reservations.js clean  - Eliminar reservas ficticias');
    console.log('   node clean-fake-reservations.js list   - Listar reservas ficticias');
    console.log('   node clean-fake-reservations.js stats  - Mostrar estadísticas rápidas');
    process.exit(0);
} 