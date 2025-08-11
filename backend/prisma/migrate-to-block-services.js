const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateToBlockServices() {
  console.log('🚀 Iniciando migración al nuevo sistema de servicios por bloque...');
  
  try {
    // 1. Crear la nueva tabla BlockServiceType
    console.log('📋 Creando nueva tabla BlockServiceType...');
    
    // 2. Migrar los tipos de servicio existentes a la nueva estructura
    console.log('🔄 Migrando tipos de servicio existentes...');
    
    const hotels = await prisma.hotel.findMany();
    
    for (const hotel of hotels) {
      console.log(`🏨 Procesando hotel: ${hotel.name}`);
      
      // Obtener todos los tipos de servicio del hotel
      const serviceTypes = await prisma.serviceType.findMany({
        where: { hotelId: hotel.id }
      });
      
      console.log(`  📊 Encontrados ${serviceTypes.length} tipos de servicio`);
      
      // Obtener todos los bloques de temporada del hotel
      const seasonBlocks = await prisma.seasonBlock.findMany({
        where: { hotelId: hotel.id }
      });
      
      console.log(`  📅 Encontrados ${seasonBlocks.length} bloques de temporada`);
      
      // Para cada bloque, crear sus propios tipos de servicio
      for (const block of seasonBlocks) {
        console.log(`    📦 Procesando bloque: ${block.name}`);
        
        for (const serviceType of serviceTypes) {
          // Buscar si ya existe un ajuste de servicio para este bloque y tipo
          const existingAdjustment = await prisma.serviceAdjustment.findUnique({
            where: {
              seasonBlockId_serviceTypeId: {
                seasonBlockId: block.id,
                serviceTypeId: serviceType.id
              }
            }
          });
          
          if (existingAdjustment) {
            console.log(`      ✅ Ajuste existente para ${serviceType.name}: ${existingAdjustment.mode} ${existingAdjustment.value}`);
          } else {
            // Crear ajuste por defecto
            const defaultAdjustment = await prisma.serviceAdjustment.create({
              data: {
                seasonBlockId: block.id,
                serviceTypeId: serviceType.id,
                mode: 'PERCENTAGE',
                value: 0 // Sin ajuste por defecto
              }
            });
            console.log(`      ➕ Creado ajuste por defecto para ${serviceType.name}`);
          }
        }
      }
    }
    
    console.log('✅ Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración
migrateToBlockServices()
  .then(() => {
    console.log('🎉 Migración finalizada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  }); 