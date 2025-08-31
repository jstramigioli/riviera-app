const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBlockConfirmation() {
  console.log('🧪 Probando confirmación de bloques...\n');

  try {
    // Obtener todos los bloques
    const blocks = await prisma.seasonBlock.findMany({
      where: {
        hotelId: 'default-hotel'
      },
      include: {
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Total de bloques encontrados: ${blocks.length}`);
    
    blocks.forEach((block, index) => {
      console.log(`\n📅 Bloque ${index + 1}: ${block.name}`);
      console.log(`   ID: ${block.id}`);
      console.log(`   Estado: ${block.isDraft ? '🟡 BORRADOR' : '✅ CONFIRMADO'}`);
      console.log(`   Fechas: ${new Date(block.startDate).toISOString().split('T')[0]} - ${new Date(block.endDate).toISOString().split('T')[0]}`);
      console.log(`   Ajustes de porcentaje:`);
      
      block.blockServiceSelections.forEach(selection => {
        const adjustment = selection.percentageAdjustment || 0;
        console.log(`     - ${selection.serviceType.name}: ${adjustment}%`);
      });
    });

    // Buscar el bloque más reciente
    const latestBlock = blocks[0];
    if (latestBlock) {
      console.log(`\n🎯 Bloque más reciente: ${latestBlock.name}`);
      console.log(`   Estado actual: ${latestBlock.isDraft ? 'BORRADOR' : 'CONFIRMADO'}`);
      
      if (latestBlock.isDraft) {
        console.log('   ⚠️  Este bloque está en borrador. Debería confirmarse al guardar.');
      } else {
        console.log('   ✅ Este bloque ya está confirmado.');
      }
    }

    console.log('\n✅ Prueba completada');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBlockConfirmation(); 