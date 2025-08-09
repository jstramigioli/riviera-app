const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDuplicateKeyframes() {
  try {
    console.log('🔍 Verificando keyframes duplicados...');
    
    // Obtener todos los keyframes
    const allKeyframes = await prisma.seasonalKeyframe.findMany({
      orderBy: { date: 'asc' }
    });
    
    console.log(`📊 Total de keyframes: ${allKeyframes.length}`);
    
    if (allKeyframes.length === 0) {
      console.log('⚠️  No hay keyframes en la base de datos');
      return;
    }
    
    // Agrupar por fecha para encontrar duplicados
    const groupedByDate = {};
    allKeyframes.forEach(keyframe => {
      const dateKey = keyframe.date.toISOString().split('T')[0]; // Solo la fecha sin hora
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(keyframe);
    });
    
    // Encontrar duplicados
    const duplicates = [];
    const uniqueKeyframes = [];
    
    Object.keys(groupedByDate).forEach(dateKey => {
      const keyframesForDate = groupedByDate[dateKey];
      
      if (keyframesForDate.length > 1) {
        console.log(`⚠️  Duplicados encontrados para fecha ${dateKey}: ${keyframesForDate.length} keyframes`);
        duplicates.push(...keyframesForDate);
        
        // Mantener solo el primero (más antiguo)
        uniqueKeyframes.push(keyframesForDate[0]);
      } else {
        uniqueKeyframes.push(keyframesForDate[0]);
      }
    });
    
    console.log(`🗑️  Keyframes duplicados a eliminar: ${duplicates.length}`);
    console.log(`✅ Keyframes únicos a mantener: ${uniqueKeyframes.length}`);
    
    if (duplicates.length > 0) {
      console.log('\n📋 Detalles de duplicados:');
      duplicates.forEach((k, i) => {
        const dateStr = k.date.toISOString().split('T')[0];
        const priceStr = k.basePrice.toFixed(2);
        const isOp = k.isOperational ? 'OP' : 'NORMAL';
        const typeStr = k.operationalType || '';
        console.log(`   ${i + 1}. ${dateStr} - $${priceStr} (${isOp}${typeStr ? ' - ' + typeStr : ''}) - ID: ${k.id}`);
      });
      
      // Preguntar si eliminar duplicados
      console.log('\n❓ ¿Deseas eliminar los duplicados? (s/n)');
      // En un script real, aquí se podría usar readline para input interactivo
      // Por ahora, solo mostrar la información
    }
    
    // Mostrar keyframes únicos
    console.log('\n📋 Keyframes únicos:');
    uniqueKeyframes.forEach((k, i) => {
      const dateStr = k.date.toISOString().split('T')[0];
      const priceStr = k.basePrice.toFixed(2);
      const isOp = k.isOperational ? 'OP' : 'NORMAL';
      const typeStr = k.operationalType || '';
      console.log(`   ${i + 1}. ${dateStr} - $${priceStr} (${isOp}${typeStr ? ' - ' + typeStr : ''})`);
    });
    
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error en la verificación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateKeyframes(); 