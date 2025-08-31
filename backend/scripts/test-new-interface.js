const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNewInterface() {
  console.log('🧪 Probando nueva interfaz de tarifas por día...\n');

  try {
    // 1. Verificar tipos de habitación
    console.log('📋 Tipos de habitación disponibles:');
    const roomTypes = await prisma.roomType.findMany({
      orderBy: { orderIndex: 'asc' }
    });
    
    roomTypes.forEach((rt, index) => {
      console.log(`  ${index + 1}. ${rt.name} (ID: ${rt.id})`);
    });

    // 2. Verificar bloques activos para fechas específicas
    const testDates = ['2025-08-30', '2025-08-31', '2025-09-01'];
    
    console.log('\n📅 Verificando bloques activos por fecha:');
    for (const date of testDates) {
      const activeBlocks = await prisma.seasonBlock.findMany({
        where: {
          startDate: { lte: new Date(date) },
          endDate: { gte: new Date(date) },
          isDraft: false
        },
        include: {
          seasonPrices: {
            include: {
              roomType: true,
              serviceType: true
            }
          }
        },
        orderBy: [
          { isDraft: 'asc' },
          { startDate: 'asc' }
        ]
      });

      console.log(`\n  Fecha: ${date}`);
      if (activeBlocks.length === 0) {
        console.log('    ❌ No hay bloques confirmados');
      } else {
        const activeBlock = activeBlocks[0];
        console.log(`    ✅ Bloque activo: ${activeBlock.name}`);
        console.log(`    📊 Precios disponibles:`);
        
        activeBlock.seasonPrices.forEach(price => {
          console.log(`      - ${price.roomType.name}: $${price.basePrice} (${price.serviceType?.name || 'Sin servicio'})`);
        });
      }
    }

    // 3. Simular cálculo de tarifas por día
    console.log('\n💰 Simulando cálculo de tarifas por día:');
    const startDate = new Date('2025-08-30');
    const endDate = new Date('2025-09-02');
    const selectedRoomType = roomTypes[0]; // Primer tipo de habitación
    
    console.log(`  Tipo de habitación: ${selectedRoomType.name}`);
    console.log(`  Rango de fechas: ${startDate.toISOString().split('T')[0]} a ${endDate.toISOString().split('T')[0]}`);
    
    const rates = [];
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      const activeBlocks = await prisma.seasonBlock.findMany({
        where: {
          startDate: { lte: new Date(dateStr) },
          endDate: { gte: new Date(dateStr) },
          isDraft: false
        },
        include: {
          seasonPrices: {
            where: {
              roomTypeId: selectedRoomType.id
            },
            include: {
              serviceType: true
            }
          }
        },
        orderBy: [
          { isDraft: 'asc' },
          { startDate: 'asc' }
        ]
      });

      if (activeBlocks.length > 0 && activeBlocks[0].seasonPrices.length > 0) {
        const price = activeBlocks[0].seasonPrices[0];
        const baseRate = price.basePrice;
        rates.push({
          date: dateStr,
          baseRate: Math.round(baseRate),
          withBreakfast: Math.round(baseRate * 1.15),
          withHalfBoard: Math.round(baseRate * 1.35),
          serviceType: price.serviceType?.name || 'Tarifa base'
        });
      } else {
        rates.push({
          date: dateStr,
          baseRate: 0,
          withBreakfast: 0,
          withHalfBoard: 0,
          serviceType: 'Sin tarifa',
          noRatesAvailable: true
        });
      }
    }

    console.log('\n  📊 Tarifas calculadas:');
    rates.forEach(rate => {
      if (rate.noRatesAvailable) {
        console.log(`    ${rate.date}: Sin tarifa disponible`);
      } else {
        console.log(`    ${rate.date}: Base $${rate.baseRate} | Desayuno $${rate.withBreakfast} | Media Pensión $${rate.withHalfBoard} | ${rate.serviceType}`);
      }
    });

    console.log('\n✅ Prueba completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewInterface(); 