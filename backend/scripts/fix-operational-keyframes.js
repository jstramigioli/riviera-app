const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixOperationalKeyframes() {
  try {
    console.log('🔧 Arreglando keyframes operacionales con precio base 0...');
    
    // Obtener todos los keyframes operacionales
    const operationalKeyframes = await prisma.seasonalKeyframe.findMany({
      where: {
        isOperational: true
      },
      orderBy: { date: 'asc' }
    });
    
    console.log(`📊 Keyframes operacionales encontrados: ${operationalKeyframes.length}`);
    
    if (operationalKeyframes.length === 0) {
      console.log('✅ No hay keyframes operacionales para arreglar');
      return;
    }
    
    // Agrupar por hotel
    const hotels = [...new Set(operationalKeyframes.map(k => k.hotelId))];
    
    for (const hotelId of hotels) {
      console.log(`\n🏨 Procesando hotel: ${hotelId}`);
      
      // Obtener keyframes normales para calcular precio promedio
      const normalKeyframes = await prisma.seasonalKeyframe.findMany({
        where: {
          hotelId,
          isOperational: false
        },
        orderBy: { date: 'desc' },
        take: 10
      });
      
      let basePrice = 8000; // Precio por defecto
      if (normalKeyframes.length > 0) {
        const totalPrice = normalKeyframes.reduce((sum, k) => sum + k.basePrice, 0);
        basePrice = Math.round(totalPrice / normalKeyframes.length);
        console.log(`💰 Precio base calculado: $${basePrice.toLocaleString()}`);
      } else {
        console.log(`💰 Usando precio base por defecto: $${basePrice.toLocaleString()}`);
      }
      
      // Actualizar keyframes operacionales de este hotel
      const hotelOperationalKeyframes = operationalKeyframes.filter(k => k.hotelId === hotelId);
      
      for (const keyframe of hotelOperationalKeyframes) {
        if (keyframe.basePrice === 0) {
          console.log(`🔧 Actualizando keyframe ${keyframe.operationalType} del ${keyframe.date.toISOString().split('T')[0]}: $0 → $${basePrice.toLocaleString()}`);
          
          await prisma.seasonalKeyframe.update({
            where: { id: keyframe.id },
            data: { basePrice: basePrice }
          });
        } else {
          console.log(`✅ Keyframe ${keyframe.operationalType} del ${keyframe.date.toISOString().split('T')[0]} ya tiene precio: $${keyframe.basePrice.toLocaleString()}`);
        }
      }
    }
    
    console.log('\n✅ Proceso completado exitosamente');
    
    // Mostrar resumen final
    const finalOperationalKeyframes = await prisma.seasonalKeyframe.findMany({
      where: { isOperational: true },
      orderBy: { date: 'asc' }
    });
    
    console.log('\n📊 RESUMEN FINAL:');
    console.log(`Total de keyframes operacionales: ${finalOperationalKeyframes.length}`);
    
    finalOperationalKeyframes.forEach((keyframe, index) => {
      const dateStr = keyframe.date.toISOString().split('T')[0];
      const priceStr = keyframe.basePrice.toFixed(2);
      const typeStr = keyframe.operationalType === 'opening' ? 'APERTURA' : 'CIERRE';
      console.log(`${index + 1}. ${dateStr} - ${typeStr} - $${priceStr}`);
    });
    
  } catch (error) {
    console.error('❌ Error al arreglar keyframes operacionales:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOperationalKeyframes(); 