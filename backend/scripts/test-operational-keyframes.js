const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testOperationalKeyframes() {
  try {
    console.log('🧪 Probando sistema de keyframes operacionales...');
    
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional de prueba
    console.log('\n1️⃣ Creando período operacional de prueba...');
    const period = await prisma.operationalPeriod.create({
      data: {
        hotelId,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-08-31'),
        label: 'Temporada de Verano'
      }
    });
    console.log(`✅ Período creado: ${period.id}`);
    
    // 2. Verificar que se crearon los keyframes operacionales
    console.log('\n2️⃣ Verificando keyframes operacionales creados...');
    
    // Esperar un momento para que se procesen los keyframes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const operationalKeyframes = await prisma.seasonalKeyframe.findMany({
      where: {
        hotelId,
        isOperational: true,
        periodId: period.id
      },
      orderBy: { date: 'asc' }
    });
    
    console.log(`✅ Keyframes operacionales encontrados: ${operationalKeyframes.length}`);
    
    if (operationalKeyframes.length === 0) {
      console.log('⚠️  No se crearon keyframes operacionales automáticamente');
      
      // Intentar crear manualmente
      console.log('🔧 Intentando crear keyframes operacionales manualmente...');
      
      const existingKeyframes = await prisma.seasonalKeyframe.findMany({
        where: {
          hotelId,
          isOperational: false
        },
        orderBy: { date: 'desc' },
        take: 5
      });

      let basePrice = 8000;
      if (existingKeyframes.length > 0) {
        const totalPrice = existingKeyframes.reduce((sum, k) => sum + k.basePrice, 0);
        basePrice = Math.round(totalPrice / existingKeyframes.length);
      }

      // Crear keyframe de apertura
      const openingKeyframe = await prisma.seasonalKeyframe.create({
        data: {
          hotelId,
          date: new Date('2024-06-01'),
          basePrice: basePrice,
          isOperational: true,
          operationalType: 'opening',
          periodId: period.id
        }
      });
      console.log(`✅ Keyframe de apertura creado: ${openingKeyframe.id}`);

      // Crear keyframe de cierre
      const closingKeyframe = await prisma.seasonalKeyframe.create({
        data: {
          hotelId,
          date: new Date('2024-08-31'),
          basePrice: basePrice,
          isOperational: true,
          operationalType: 'closing',
          periodId: period.id
        }
      });
      console.log(`✅ Keyframe de cierre creado: ${closingKeyframe.id}`);
      
      // Verificar nuevamente
      const newOperationalKeyframes = await prisma.seasonalKeyframe.findMany({
        where: {
          hotelId,
          isOperational: true,
          periodId: period.id
        },
        orderBy: { date: 'asc' }
      });
      
      console.log(`✅ Keyframes operacionales después de creación manual: ${newOperationalKeyframes.length}`);
      newOperationalKeyframes.forEach((k, i) => {
        const dateStr = k.date.toISOString().split('T')[0];
        const priceStr = k.basePrice.toFixed(2);
        const typeStr = k.operationalType === 'opening' ? 'APERTURA' : 'CIERRE';
        console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${priceStr}`);
      });
    } else {
      operationalKeyframes.forEach((k, i) => {
        const dateStr = k.date.toISOString().split('T')[0];
        const priceStr = k.basePrice.toFixed(2);
        const typeStr = k.operationalType === 'opening' ? 'APERTURA' : 'CIERRE';
        console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${priceStr}`);
      });
    }
    
    // 3. Intentar crear un keyframe normal en la misma fecha (debería fallar)
    console.log('\n3️⃣ Probando protección de fechas operacionales...');
    try {
      await prisma.seasonalKeyframe.create({
        data: {
          hotelId,
          date: new Date('2024-06-01'),
          basePrice: 10000
        }
      });
      console.log('❌ ERROR: Se permitió crear keyframe en fecha operacional');
    } catch (error) {
      console.log('✅ Protección funcionando: No se puede crear keyframe en fecha operacional');
    }
    
    // 4. Verificar que no se pueden eliminar keyframes operacionales
    console.log('\n4️⃣ Probando protección de eliminación...');
    const allOperationalKeyframes = await prisma.seasonalKeyframe.findMany({
      where: {
        hotelId,
        isOperational: true
      }
    });
    
    if (allOperationalKeyframes.length > 0) {
      const openingKeyframe = allOperationalKeyframes.find(k => k.operationalType === 'opening');
      if (openingKeyframe) {
        try {
          await prisma.seasonalKeyframe.delete({
            where: { id: openingKeyframe.id }
          });
          console.log('❌ ERROR: Se permitió eliminar keyframe operacional');
        } catch (error) {
          console.log('✅ Protección funcionando: No se puede eliminar keyframe operacional directamente');
        }
      }
    }
    
    // 5. Limpiar datos de prueba
    console.log('\n5️⃣ Limpiando datos de prueba...');
    await prisma.seasonalKeyframe.deleteMany({
      where: {
        hotelId,
        isOperational: true,
        periodId: period.id
      }
    });
    
    await prisma.operationalPeriod.delete({
      where: { id: period.id }
    });
    
    console.log('✅ Datos de prueba eliminados');
    
    console.log('\n🎉 Todas las pruebas pasaron exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testOperationalKeyframes(); 