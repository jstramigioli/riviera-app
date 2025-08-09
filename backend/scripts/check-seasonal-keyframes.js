const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSeasonalKeyframes() {
  try {
    console.log('🔍 Verificando estado actual de keyframes estacionales...');
    
    // Obtener todos los keyframes
    const allKeyframes = await prisma.seasonalKeyframe.findMany({
      orderBy: { date: 'asc' }
    });
    
    console.log(`📊 Total de keyframes en la base de datos: ${allKeyframes.length}`);
    
    if (allKeyframes.length === 0) {
      console.log('⚠️  No hay keyframes en la base de datos');
      return;
    }
    
    // Agrupar por hotelId
    const groupedByHotel = {};
    allKeyframes.forEach(keyframe => {
      const hotelId = keyframe.hotelId;
      if (!groupedByHotel[hotelId]) {
        groupedByHotel[hotelId] = [];
      }
      groupedByHotel[hotelId].push(keyframe);
    });
    
    // Mostrar información por hotel
    Object.keys(groupedByHotel).forEach(hotelId => {
      const keyframes = groupedByHotel[hotelId];
      console.log(`\n🏨 Hotel: ${hotelId}`);
      console.log(`   Total de keyframes: ${keyframes.length}`);
      
      keyframes.forEach((keyframe, index) => {
        const dateStr = keyframe.date.toISOString().split('T')[0];
        const priceStr = keyframe.basePrice.toFixed(2);
        console.log(`   ${index + 1}. ${dateStr} - $${priceStr} (ID: ${keyframe.id})`);
      });
    });
    
    // Verificar si hay duplicados
    console.log('\n🔍 Verificando duplicados...');
    const duplicates = [];
    Object.keys(groupedByHotel).forEach(hotelId => {
      const keyframes = groupedByHotel[hotelId];
      const dateMap = {};
      
      keyframes.forEach(keyframe => {
        const dateKey = keyframe.date.toISOString().split('T')[0];
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = [];
        }
        dateMap[dateKey].push(keyframe);
      });
      
      Object.keys(dateMap).forEach(dateKey => {
        if (dateMap[dateKey].length > 1) {
          console.log(`⚠️  Duplicados encontrados para hotel ${hotelId}, fecha ${dateKey}: ${dateMap[dateKey].length} puntos`);
          duplicates.push(...dateMap[dateKey]);
        }
      });
    });
    
    if (duplicates.length > 0) {
      console.log(`\n🗑️  Total de duplicados: ${duplicates.length}`);
    } else {
      console.log('\n✅ No se encontraron duplicados');
    }
    
  } catch (error) {
    console.error('❌ Error al verificar keyframes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSeasonalKeyframes(); 