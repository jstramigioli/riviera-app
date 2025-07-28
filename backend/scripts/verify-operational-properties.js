const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyOperationalProperties() {
  try {
    console.log('🔍 Verificando propiedades operacionales de keyframes...');
    
    // Obtener todos los keyframes
    const allKeyframes = await prisma.seasonalKeyframe.findMany({
      orderBy: { date: 'asc' }
    });
    
    console.log(`📊 Total de keyframes: ${allKeyframes.length}`);
    
    if (allKeyframes.length === 0) {
      console.log('⚠️  No hay keyframes en la base de datos');
      return;
    }
    
    // Verificar keyframes operacionales
    const operationalKeyframes = allKeyframes.filter(k => k.isOperational);
    const normalKeyframes = allKeyframes.filter(k => !k.isOperational);
    
    console.log(`\n🔧 Keyframes operacionales: ${operationalKeyframes.length}`);
    operationalKeyframes.forEach((k, i) => {
      const dateStr = k.date.toISOString().split('T')[0];
      const priceStr = k.basePrice.toFixed(2);
      const typeStr = k.operationalType || 'SIN_TIPO';
      const periodId = k.periodId || 'SIN_PERIODO';
      console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${priceStr} (PeriodId: ${periodId})`);
    });
    
    console.log(`\n📈 Keyframes normales: ${normalKeyframes.length}`);
    normalKeyframes.forEach((k, i) => {
      const dateStr = k.date.toISOString().split('T')[0];
      const priceStr = k.basePrice.toFixed(2);
      console.log(`   ${i + 1}. ${dateStr} - $${priceStr}`);
    });
    
    // Verificar períodos operacionales
    const periods = await prisma.operationalPeriod.findMany({
      orderBy: { startDate: 'asc' }
    });
    
    console.log(`\n📅 Períodos operacionales: ${periods.length}`);
    periods.forEach((period, i) => {
      const startStr = period.startDate.toISOString().split('T')[0];
      const endStr = period.endDate.toISOString().split('T')[0];
      console.log(`   ${i + 1}. ${startStr} - ${endStr} (${period.label || 'Sin etiqueta'})`);
    });
    
    // Verificar consistencia
    console.log('\n🔍 Verificando consistencia...');
    
    for (const period of periods) {
      const periodKeyframes = operationalKeyframes.filter(k => k.periodId === period.id);
      console.log(`\n📋 Período ${period.id}:`);
      console.log(`   Fechas: ${period.startDate.toISOString().split('T')[0]} - ${period.endDate.toISOString().split('T')[0]}`);
      console.log(`   Keyframes asociados: ${periodKeyframes.length}`);
      
      periodKeyframes.forEach(k => {
        const dateStr = k.date.toISOString().split('T')[0];
        const typeStr = k.operationalType || 'SIN_TIPO';
        console.log(`     - ${dateStr} (${typeStr})`);
      });
    }
    
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error en la verificación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyOperationalProperties(); 