const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createDefaultKeyframes() {
  try {
    console.log('🔄 Creando puntos por defecto para la curva estacional...');
    
    // Eliminar todos los puntos existentes
    await prisma.seasonalKeyframe.deleteMany();
    console.log('🗑️  Puntos existentes eliminados');
    
    // Crear puntos por defecto bien distribuidos
    const defaultKeyframes = [
      {
        hotelId: 'default-hotel',
        date: new Date('2024-01-01'),
        basePrice: 8000.00,
        description: 'Baja temporada - Enero'
      },
      {
        hotelId: 'default-hotel',
        date: new Date('2024-03-01'),
        basePrice: 10000.00,
        description: 'Temporada media - Marzo'
      },
      {
        hotelId: 'default-hotel',
        date: new Date('2024-07-01'),
        basePrice: 15000.00,
        description: 'Alta temporada - Julio'
      },
      {
        hotelId: 'default-hotel',
        date: new Date('2024-12-01'),
        basePrice: 12000.00,
        description: 'Temporada media - Diciembre'
      }
    ];
    
    // Crear los puntos por defecto
    for (const keyframe of defaultKeyframes) {
      await prisma.seasonalKeyframe.create({
        data: {
          hotelId: keyframe.hotelId,
          date: keyframe.date,
          basePrice: keyframe.basePrice
        }
      });
    }
    
    console.log('✅ Puntos por defecto creados exitosamente');
    
    // Mostrar resultado final
    const finalKeyframes = await prisma.seasonalKeyframe.findMany({
      orderBy: { date: 'asc' }
    });
    
    console.log('\n📊 PUNTOS POR DEFECTO CREADOS:');
    console.log(`Total de puntos: ${finalKeyframes.length}`);
    
    finalKeyframes.forEach((keyframe, index) => {
      const dateStr = keyframe.date.toISOString().split('T')[0];
      const priceStr = keyframe.basePrice.toFixed(2);
      console.log(`${index + 1}. ${dateStr} - $${priceStr}`);
    });
    
    console.log('\n💡 Estos puntos crean una curva estacional básica:');
    console.log('   - Enero: Baja temporada ($8,000)');
    console.log('   - Marzo: Temporada media ($10,000)');
    console.log('   - Julio: Alta temporada ($15,000)');
    console.log('   - Diciembre: Temporada media ($12,000)');
    
  } catch (error) {
    console.error('❌ Error creando puntos por defecto:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
createDefaultKeyframes(); 