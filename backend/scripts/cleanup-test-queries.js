const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupTestQueries() {
  try {
    console.log('🧹 Limpiando consultas de prueba...\n');

    // Eliminar todas las consultas de prueba
    const deletedQueries = await prisma.query.deleteMany({
      where: {
        notes: {
          contains: 'prueba'
        }
      }
    });

    console.log(`✅ ${deletedQueries.count} consultas de prueba eliminadas`);

    // Verificar estado final
    const remainingQueries = await prisma.query.findMany();
    console.log(`📊 Consultas restantes: ${remainingQueries.length}`);

    console.log('\n🎉 Limpieza completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  cleanupTestQueries()
    .then(() => {
      console.log('✅ Limpieza finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en la limpieza:', error);
      process.exit(1);
    });
}

module.exports = { cleanupTestQueries }; 