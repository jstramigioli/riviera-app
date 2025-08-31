const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDynamicColumns() {
  console.log('🧪 Probando columnas dinámicas...\n');

  try {
    // Obtener el bloque activo
    const seasonBlock = await prisma.seasonBlock.findFirst({
      where: {
        hotelId: 'default-hotel'
      },
      include: {
        blockServiceSelections: {
          include: {
            serviceType: true
          }
        },
        seasonPrices: {
          include: {
            roomType: true,
            serviceType: true
          }
        }
      }
    });

    if (!seasonBlock) {
      console.log('❌ No se encontró un bloque');
      return;
    }

    console.log(`📊 Bloque: ${seasonBlock.name}`);
    
    // Simular la lógica del frontend
    const serviceAdjustments = seasonBlock.blockServiceSelections || [];
    const enabledServices = serviceAdjustments.filter(selection => selection.isEnabled);
    
    console.log('\n🎛️ Servicios habilitados:');
    enabledServices.forEach(service => {
      console.log(`  - ${service.serviceType.name} (ajuste: ${service.percentageAdjustment || 0}%)`);
    });

    // Simular cálculo de precios para habitación single
    const roomTypeId = 1; // single
    const roomTypePrices = seasonBlock.seasonPrices.filter(p => p.roomTypeId === roomTypeId);
    
    if (roomTypePrices.length > 0) {
      console.log('\n💰 Cálculo de precios (simulando frontend):');
      
      // Crear objeto con precios para todos los servicios
      const servicePrices = {};
      
      // Agregar precio base
      const basePrice = roomTypePrices.find(price => 
        !price.serviceType || price.serviceType.name === 'Tarifa base'
      ) || roomTypePrices[0];
      
      // Solo agregar baseRate si no hay un servicio llamado "Tarifa base"
      const hasTarifaBaseService = enabledServices.some(service => 
        service.serviceType.name === 'Tarifa base'
      );
      
      if (!hasTarifaBaseService) {
        servicePrices.baseRate = Math.round(basePrice.basePrice);
        console.log(`  - baseRate: $${servicePrices.baseRate}`);
      }
      
      // Agregar precios para cada servicio habilitado
      enabledServices.forEach(serviceSelection => {
        const serviceName = serviceSelection.serviceType.name;
        const servicePrice = roomTypePrices.find(price => 
          price.serviceType && price.serviceType.name === serviceName
        );
        
        if (servicePrice) {
          const adjustment = serviceSelection.percentageAdjustment || 0;
          const adjustedPrice = servicePrice.basePrice * (1 + adjustment / 100);
          servicePrices[serviceName] = Math.round(adjustedPrice);
          console.log(`  - ${serviceName}: $${servicePrices[serviceName]} (base: $${servicePrice.basePrice} + ${adjustment}%)`);
        } else {
          // Si no hay precio específico para el servicio, usar precio base
          const adjustment = serviceSelection.percentageAdjustment || 0;
          const adjustedPrice = basePrice.basePrice * (1 + adjustment / 100);
          servicePrices[serviceName] = Math.round(adjustedPrice);
          console.log(`  - ${serviceName}: $${servicePrices[serviceName]} (base: $${basePrice.basePrice} + ${adjustment}%)`);
        }
      });

      // Simular la función getEnabledServices
      const excludeKeys = ['date', 'blockName', 'noRatesAvailable'];
      const serviceKeys = Object.keys(servicePrices).filter(key => !excludeKeys.includes(key));
      
      // Si hay tanto 'baseRate' como 'Tarifa base', remover 'baseRate'
      const finalServiceKeys = serviceKeys.includes('baseRate') && serviceKeys.includes('Tarifa base') 
        ? serviceKeys.filter(key => key !== 'baseRate')
        : serviceKeys;
      
      console.log('\n📋 Columnas finales que se mostrarán:');
      console.log('  - Fecha');
      console.log('  - Bloque');
      finalServiceKeys.forEach(key => {
        const displayName = key === 'baseRate' ? 'Precio Base' : key;
        console.log(`  - ${displayName}`);
      });

      // Verificar duplicados
      const hasDuplicates = finalServiceKeys.includes('baseRate') && finalServiceKeys.includes('Tarifa base');
      console.log(`\n🔍 Verificación de duplicados: ${hasDuplicates ? '❌ HAY DUPLICADOS' : '✅ SIN DUPLICADOS'}`);
    }

    console.log('\n✅ Prueba completada');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDynamicColumns(); 