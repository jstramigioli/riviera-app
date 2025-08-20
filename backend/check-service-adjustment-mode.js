const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkServiceAdjustmentMode() {
  try {
    console.log('=== CHECKING SERVICE ADJUSTMENT MODE ===');
    
    // Obtener todos los bloques de temporada
    const blocks = await prisma.seasonBlock.findMany({
      select: {
        id: true,
        name: true,
        serviceAdjustmentMode: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    console.log('Total blocks found:', blocks.length);
    
    blocks.forEach((block, index) => {
      console.log(`Block ${index + 1}:`, {
        id: block.id,
        name: block.name,
        serviceAdjustmentMode: block.serviceAdjustmentMode,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt
      });
    });
    
    // Verificar si hay algún bloque con serviceAdjustmentMode null o undefined
    const blocksWithNullMode = blocks.filter(block => 
      block.serviceAdjustmentMode === null || block.serviceAdjustmentMode === undefined
    );
    
    if (blocksWithNullMode.length > 0) {
      console.log('\n⚠️  BLOCKS WITH NULL/UNDEFINED serviceAdjustmentMode:');
      blocksWithNullMode.forEach(block => {
        console.log(`- ${block.name} (${block.id})`);
      });
    } else {
      console.log('\n✅ All blocks have serviceAdjustmentMode defined');
    }
    
  } catch (error) {
    console.error('Error checking serviceAdjustmentMode:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkServiceAdjustmentMode(); 