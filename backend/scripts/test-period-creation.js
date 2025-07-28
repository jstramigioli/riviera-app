const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPeriodCreation() {
  try {
    console.log('🧪 Probando creación de período operacional...');
    
    const hotelId = 'default-hotel';
    
    // 1. Crear un período operacional
    console.log('\n1️⃣ Creando período operacional...');
    const period = await prisma.operationalPeriod.create({
      data: {
        hotelId,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-08-31'),
        label: 'Temporada de Verano Test'
      }
    });
    console.log(`✅ Período creado: ${period.id}`);
    
    // 2. Verificar que se crearon los keyframes operacionales
    console.log('\n2️⃣ Verificando keyframes operacionales...');
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
    operationalKeyframes.forEach((k, i) => {
      const dateStr = k.date.toISOString().split('T')[0];
      const priceStr = k.basePrice.toFixed(2);
      const typeStr = k.operationalType || 'SIN_TIPO';
      console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${priceStr}`);
    });
    
    // 3. Verificar todos los keyframes
    console.log('\n3️⃣ Verificando todos los keyframes...');
    const allKeyframes = await prisma.seasonalKeyframe.findMany({
      where: { hotelId },
      orderBy: { date: 'asc' }
    });
    
    console.log(`📊 Total de keyframes: ${allKeyframes.length}`);
    allKeyframes.forEach((k, i) => {
      const dateStr = k.date.toISOString().split('T')[0];
      const priceStr = k.basePrice.toFixed(2);
      const isOp = k.isOperational ? 'OP' : 'NORMAL';
      const typeStr = k.operationalType || '';
      console.log(`   ${i + 1}. ${dateStr} - $${priceStr} (${isOp}${typeStr ? ' - ' + typeStr : ''})`);
    });
    
    // 4. Eliminar el período para limpiar
    console.log('\n4️⃣ Eliminando período de prueba...');
    
    // Buscar keyframes operacionales asociados
    const operationalKeyframesToDelete = await prisma.seasonalKeyframe.findMany({
      where: {
        periodId: period.id,
        isOperational: true
      }
    });
    
    // Encontrar las fechas de apertura y cierre
    const openingKeyframe = operationalKeyframesToDelete.find(k => k.operationalType === 'opening');
    const closingKeyframe = operationalKeyframesToDelete.find(k => k.operationalType === 'closing');
    
    if (openingKeyframe && closingKeyframe) {
      // Eliminar TODOS los keyframes entre la fecha de apertura y cierre (inclusive)
      const deletedCount = await prisma.seasonalKeyframe.deleteMany({
        where: {
          hotelId: period.hotelId,
          date: {
            gte: openingKeyframe.date,
            lte: closingKeyframe.date
          }
        }
      });
      
      console.log(`🗑️  Eliminados ${deletedCount.count} keyframes entre ${openingKeyframe.date.toISOString()} y ${closingKeyframe.date.toISOString()}`);
    }
    
    // Eliminar el período
    await prisma.operationalPeriod.delete({
      where: { id: period.id }
    });
    
    console.log('✅ Período eliminado');
    
    console.log('\n🎉 Prueba completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodCreation(); 