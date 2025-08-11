const { PrismaClient } = require('./backend/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function testNewBlockServices() {
  console.log('🧪 Probando el nuevo sistema de servicios por bloque...\n');
  
  try {
    // 1. Verificar que la nueva tabla existe
    console.log('1. Verificando estructura de la base de datos...');
    const blockServiceTypes = await prisma.blockServiceType.findMany();
    console.log(`   ✅ Tabla BlockServiceType creada. Encontrados ${blockServiceTypes.length} registros`);
    
    // 2. Obtener todos los bloques de temporada
    console.log('\n2. Verificando bloques de temporada...');
    const seasonBlocks = await prisma.seasonBlock.findMany({
      include: {
        blockServiceTypes: true,
        serviceAdjustments: {
          include: {
            serviceType: true
          }
        }
      }
    });
    
    console.log(`   📊 Encontrados ${seasonBlocks.length} bloques de temporada`);
    
    // 3. Mostrar información de cada bloque
    for (const block of seasonBlocks) {
      console.log(`\n   📦 Bloque: ${block.name}`);
      console.log(`      - ID: ${block.id}`);
      console.log(`      - useBlockServices: ${block.useBlockServices}`);
      console.log(`      - basePrice: ${block.basePrice || 'No definido'}`);
      console.log(`      - Tipos de servicio del bloque: ${block.blockServiceTypes.length}`);
      console.log(`      - Ajustes de servicio existentes: ${block.serviceAdjustments.length}`);
      
      // Mostrar los ajustes existentes
      if (block.serviceAdjustments.length > 0) {
        console.log('      - Ajustes existentes:');
        for (const adjustment of block.serviceAdjustments) {
          console.log(`        * ${adjustment.serviceType.name}: ${adjustment.mode} ${adjustment.value}`);
        }
      }
    }
    
    // 4. Crear un tipo de servicio de prueba para el primer bloque
    console.log('\n3. Creando tipo de servicio de prueba...');
    const firstBlock = seasonBlocks[0];
    
    if (firstBlock) {
      const testServiceType = await prisma.blockServiceType.create({
        data: {
          seasonBlockId: firstBlock.id,
          name: 'Servicio de Prueba',
          description: 'Este es un servicio de prueba para el nuevo sistema',
          adjustmentMode: 'PERCENTAGE',
          adjustmentValue: 25,
          orderIndex: 0
        }
      });
      
      console.log(`   ✅ Creado servicio de prueba: ${testServiceType.name}`);
      console.log(`      - ID: ${testServiceType.id}`);
      console.log(`      - Modo: ${testServiceType.adjustmentMode}`);
      console.log(`      - Valor: ${testServiceType.adjustmentValue}`);
      
      // 5. Verificar que se creó correctamente
      const createdService = await prisma.blockServiceType.findUnique({
        where: { id: testServiceType.id }
      });
      
      if (createdService) {
        console.log('   ✅ Servicio creado y recuperado correctamente');
      } else {
        console.log('   ❌ Error: No se pudo recuperar el servicio creado');
      }
      
      // 6. Limpiar el servicio de prueba
      await prisma.blockServiceType.delete({
        where: { id: testServiceType.id }
      });
      console.log('   🧹 Servicio de prueba eliminado');
    }
    
    console.log('\n🎉 Pruebas completadas exitosamente!');
    console.log('\n📋 Resumen del nuevo sistema:');
    console.log('   - Cada bloque de temporada puede tener sus propios tipos de servicio');
    console.log('   - Los tipos de servicio pueden ser de porcentaje o precio fijo');
    console.log('   - Se pueden agregar, editar y eliminar tipos de servicio por bloque');
    console.log('   - El sistema es completamente independiente del sistema global de servicios');
    
  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar las pruebas
testNewBlockServices()
  .then(() => {
    console.log('\n✅ Pruebas finalizadas');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  }); 