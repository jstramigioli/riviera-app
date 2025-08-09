const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanSeasonalKeyframes() {
  try {
    console.log('🔍 Verificando puntos duplicados en la curva estacional...');
    
    // Obtener todos los keyframes
    const allKeyframes = await prisma.seasonalKeyframe.findMany({
      orderBy: { date: 'asc' }
    });
    
    console.log(`📊 Total de puntos encontrados: ${allKeyframes.length}`);
    
    // Agrupar por hotelId y fecha para encontrar duplicados
    const groupedByHotel = {};
    
    allKeyframes.forEach(keyframe => {
      const hotelId = keyframe.hotelId;
      const dateKey = keyframe.date.toISOString().split('T')[0]; // Solo la fecha sin hora
      
      if (!groupedByHotel[hotelId]) {
        groupedByHotel[hotelId] = {};
      }
      
      if (!groupedByHotel[hotelId][dateKey]) {
        groupedByHotel[hotelId][dateKey] = [];
      }
      
      groupedByHotel[hotelId][dateKey].push(keyframe);
    });
    
    // Encontrar duplicados
    const duplicates = [];
    const uniqueKeyframes = [];
    
    Object.keys(groupedByHotel).forEach(hotelId => {
      Object.keys(groupedByHotel[hotelId]).forEach(dateKey => {
        const keyframesForDate = groupedByHotel[hotelId][dateKey];
        
        if (keyframesForDate.length > 1) {
          console.log(`⚠️  Duplicados encontrados para hotel ${hotelId}, fecha ${dateKey}: ${keyframesForDate.length} puntos`);
          duplicates.push(...keyframesForDate);
          
          // Mantener solo el primero (más antiguo)
          uniqueKeyframes.push(keyframesForDate[0]);
        } else {
          uniqueKeyframes.push(keyframesForDate[0]);
        }
      });
    });
    
    console.log(`🗑️  Puntos duplicados a eliminar: ${duplicates.length}`);
    console.log(`✅ Puntos únicos a mantener: ${uniqueKeyframes.length}`);
    
    if (duplicates.length > 0) {
      // Eliminar duplicados
      const duplicateIds = duplicates.map(k => k.id);
      await prisma.seasonalKeyframe.deleteMany({
        where: {
          id: { in: duplicateIds }
        }
      });
      console.log('✅ Duplicados eliminados exitosamente');
    }
    
    // Verificar si hay suficientes puntos por defecto
    const remainingKeyframes = await prisma.seasonalKeyframe.findMany({
      orderBy: { date: 'asc' }
    });
    
    console.log(`📊 Puntos restantes después de limpieza: ${remainingKeyframes.length}`);
    
    // Si hay menos de 4 puntos, crear puntos por defecto
    if (remainingKeyframes.length < 4) {
      console.log('🔄 Creando puntos por defecto...');
      
      const defaultKeyframes = [
        {
          hotelId: 'default-hotel',
          date: new Date('2024-01-01'),
          basePrice: 8000.00
        },
        {
          hotelId: 'default-hotel',
          date: new Date('2024-03-01'),
          basePrice: 10000.00
        },
        {
          hotelId: 'default-hotel',
          date: new Date('2024-07-01'),
          basePrice: 15000.00
        },
        {
          hotelId: 'default-hotel',
          date: new Date('2024-12-01'),
          basePrice: 12000.00
        }
      ];
      
      // Eliminar puntos existentes si hay muy pocos
      if (remainingKeyframes.length < 2) {
        await prisma.seasonalKeyframe.deleteMany();
        console.log('🗑️  Puntos existentes eliminados para crear nuevos por defecto');
      }
      
      // Crear puntos por defecto
      for (const keyframe of defaultKeyframes) {
        await prisma.seasonalKeyframe.create({
          data: keyframe
        });
      }
      
      console.log('✅ Puntos por defecto creados exitosamente');
    }
    
    // Mostrar resultado final
    const finalKeyframes = await prisma.seasonalKeyframe.findMany({
      orderBy: { date: 'asc' }
    });
    
    console.log('\n📊 RESULTADO FINAL:');
    console.log(`Total de puntos: ${finalKeyframes.length}`);
    
    finalKeyframes.forEach((keyframe, index) => {
      console.log(`${index + 1}. ${keyframe.date.toISOString().split('T')[0]} - $${keyframe.basePrice.toFixed(2)}`);
    });
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
cleanSeasonalKeyframes(); 