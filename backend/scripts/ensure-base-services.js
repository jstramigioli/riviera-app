const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ensureBaseServices() {
  try {
    console.log('🚀 Verificando servicios base en bloques de temporada...');
    
    const hotelId = 'default-hotel';
    
    // Obtener el servicio base (Solo Alojamiento)
    const baseService = await prisma.serviceType.findFirst({
      where: {
        hotelId: hotelId,
        name: 'Solo Alojamiento'
      }
    });
    
    if (!baseService) {
      console.error('❌ No se encontró el servicio base "Solo Alojamiento"');
      return;
    }
    
    console.log(`✅ Servicio base encontrado: ${baseService.name} (ID: ${baseService.id})`);
    
    // Obtener todos los bloques de temporada
    const seasonBlocks = await prisma.seasonBlock.findMany({
      where: { hotelId: hotelId },
      include: {
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        }
      }
    });
    
    console.log(`📋 Encontrados ${seasonBlocks.length} bloques de temporada`);
    
    let updatedBlocks = 0;
    
    for (const block of seasonBlocks) {
      console.log(`\n🔍 Verificando bloque: ${block.name}`);
      
      // Verificar si ya tiene el servicio base
      const hasBaseService = block.blockServiceSelections.some(selection => 
        selection.serviceTypeId === baseService.id
      );
      
      if (!hasBaseService) {
        console.log(`   ⚠️  Bloque "${block.name}" no tiene servicio base, agregando...`);
        
        // Crear selección del servicio base
        await prisma.blockServiceSelection.create({
          data: {
            seasonBlockId: block.id,
            serviceTypeId: baseService.id,
            isEnabled: true,
            pricingMode: 'PERCENTAGE',
            percentage: 0,
            orderIndex: 0
          }
        });
        
        console.log(`   ✅ Servicio base agregado al bloque "${block.name}"`);
        updatedBlocks++;
      } else {
        console.log(`   ✅ Bloque "${block.name}" ya tiene servicio base`);
      }
      
      // Verificar si tiene precios para el servicio base
      const hasBasePrices = await prisma.seasonPrice.findMany({
        where: {
          seasonBlockId: block.id,
          serviceTypeId: baseService.id
        }
      });
      
      if (hasBasePrices.length === 0) {
        console.log(`   ⚠️  Bloque "${block.name}" no tiene precios para servicio base, creando...`);
        
        // Obtener tipos de habitación
        const roomTypes = await prisma.roomType.findMany();
        
        // Crear precios base por defecto
        for (const roomType of roomTypes) {
          await prisma.seasonPrice.create({
            data: {
              seasonBlockId: block.id,
              roomTypeId: roomType.id,
              serviceTypeId: baseService.id,
              basePrice: 50000 // $500 por defecto
            }
          });
        }
        
        console.log(`   ✅ Precios base creados para ${roomTypes.length} tipos de habitación`);
      } else {
        console.log(`   ✅ Bloque "${block.name}" ya tiene precios para servicio base`);
      }
    }
    
    console.log(`\n🎉 Proceso completado. ${updatedBlocks} bloques actualizados.`);
    
  } catch (error) {
    console.error('❌ Error asegurando servicios base:', error);
  } finally {
    await prisma.$disconnect();
  }
}

ensureBaseServices(); 