const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFrontendAdjustments() {
  console.log('🧪 Probando cálculo de precios como el frontend...\n');

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
    
    // Simular el estado del frontend
    const percentageAdjustments = {};
    seasonBlock.blockServiceSelections.forEach(selection => {
      if (selection.percentageAdjustment !== null && selection.percentageAdjustment !== undefined) {
        percentageAdjustments[selection.id] = selection.percentageAdjustment;
      }
    });

    console.log('\n🎛️ Ajustes de porcentaje (estado frontend):');
    Object.keys(percentageAdjustments).forEach(key => {
      const selection = seasonBlock.blockServiceSelections.find(s => s.id === key);
      console.log(`  - ${selection.serviceType.name}: ${percentageAdjustments[key]}%`);
    });

    // Simular getPriceDisplayInfo para habitación single
    const roomTypeId = 1; // single
    const roomTypePrices = seasonBlock.seasonPrices.filter(p => p.roomTypeId === roomTypeId);
    
    console.log('\n💰 Cálculo de precios (simulando frontend):');
    roomTypePrices.forEach(price => {
      const serviceName = price.serviceType.name;
      const serviceTypeId = price.serviceTypeId;
      
      // Buscar ajuste de porcentaje
      let percentageAdjustment = percentageAdjustments[serviceTypeId];
      
      if (percentageAdjustment === undefined) {
        const serviceSelection = seasonBlock.blockServiceSelections.find(s => 
          s.serviceTypeId === serviceTypeId
        );
        if (serviceSelection) {
          percentageAdjustment = percentageAdjustments[serviceSelection.id];
        }
      }
      
      let basePrice = price.basePrice;
      let adjustedPrice = basePrice;
      
      // Si hay ajuste y no es "Tarifa base", usar "Tarifa base" como referencia
      if (percentageAdjustment && percentageAdjustment !== 0 && serviceName !== 'Tarifa base') {
        const baseServicePrice = roomTypePrices.find(p => 
          p.serviceType.name === 'Tarifa base'
        );
        
        if (baseServicePrice) {
          basePrice = baseServicePrice.basePrice;
          const adjustmentMultiplier = 1 + (percentageAdjustment / 100);
          adjustedPrice = Math.round(basePrice * adjustmentMultiplier);
          
          console.log(`  - ${serviceName}: $${basePrice} base + ${percentageAdjustment}% = $${adjustedPrice}`);
        }
      } else {
        console.log(`  - ${serviceName}: $${adjustedPrice} (sin ajuste)`);
      }
    });

    console.log('\n✅ Prueba completada');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFrontendAdjustments(); 