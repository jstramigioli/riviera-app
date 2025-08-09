const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAndRegenerateRates() {
  try {
    console.log('🧹 Limpiando tarifas existentes...');
    
    // Eliminar todas las tarifas existentes
    await prisma.dailyRoomRate.deleteMany({
      where: {
        hotelId: 'default-hotel'
      }
    });
    
    console.log('✅ Tarifas eliminadas');
    
    // Verificar que los precios dinámicos estén desactivados
    const config = await prisma.dynamicPricingConfig.findUnique({
      where: { hotelId: 'default-hotel' }
    });
    
    if (!config) {
      console.log('❌ No se encontró configuración de precios dinámicos');
      return;
    }
    
    console.log(`📊 Configuración actual: enabled = ${config.enabled}`);
    
    // Generar nuevas tarifas para un rango de fechas
    const startDate = new Date('2025-07-01');
    const endDate = new Date('2025-08-31');
    
    console.log('🔄 Generando nuevas tarifas...');
    
    // Obtener tipos de habitación
    const roomTypes = await prisma.roomType.findMany();
    
    for (const roomType of roomTypes) {
      console.log(`📝 Generando tarifas para ${roomType.name}...`);
      
      // Generar tarifas día por día
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const currentDate = new Date(date);
        
        // Obtener precio base desde la curva estacional
        const keyframes = await prisma.seasonalKeyframe.findMany({
          where: { hotelId: 'default-hotel' },
          orderBy: { date: 'asc' }
        });
        
        if (keyframes.length === 0) {
          console.log('❌ No se encontraron keyframes estacionales');
          continue;
        }
        
        // Encontrar keyframes más cercanos
        let beforeKeyframe = null;
        let afterKeyframe = null;
        
        for (let i = 0; i < keyframes.length - 1; i++) {
          const current = new Date(keyframes[i].date);
          const next = new Date(keyframes[i + 1].date);
          if (currentDate >= current && currentDate <= next) {
            beforeKeyframe = keyframes[i];
            afterKeyframe = keyframes[i + 1];
            break;
          }
        }
        
        if (!beforeKeyframe || !afterKeyframe) {
          // Usar el keyframe más cercano
          const closest = keyframes.reduce((prev, curr) => {
            const prevDiff = Math.abs(new Date(prev.date) - currentDate);
            const currDiff = Math.abs(new Date(curr.date) - currentDate);
            return prevDiff < currDiff ? prev : curr;
          });
          beforeKeyframe = closest;
          afterKeyframe = closest;
        }
        
        // Interpolar precio base
        const beforeDate = new Date(beforeKeyframe.date);
        const afterDate = new Date(afterKeyframe.date);
        const totalDiff = afterDate - beforeDate;
        const targetDiff = currentDate - beforeDate;
        const ratio = totalDiff > 0 ? targetDiff / totalDiff : 0;
        const baseRate = beforeKeyframe.basePrice + (afterKeyframe.basePrice - beforeKeyframe.basePrice) * ratio;
        

        
        // Aplicar coeficiente del tipo de habitación
        const adjustedBaseRate = baseRate * roomType.multiplier;
        
        // Si los precios dinámicos están desactivados, usar el precio base ajustado
        const dynamicRate = config.enabled ? adjustedBaseRate : adjustedBaseRate;
        
        // Calcular precios con comidas
        const mealRules = await prisma.mealPricingRule.findUnique({
          where: { hotelId: 'default-hotel' }
        });
        
        let withBreakfast = dynamicRate;
        let withHalfBoard = dynamicRate;
        
        if (mealRules) {
          if (mealRules.breakfastMode === 'FIXED') {
            withBreakfast = dynamicRate + mealRules.breakfastValue;
          } else {
            withBreakfast = dynamicRate * (1 + mealRules.breakfastValue);
          }
          
          if (mealRules.dinnerMode === 'FIXED') {
            withHalfBoard = withBreakfast + mealRules.dinnerValue;
          } else {
            withHalfBoard = withBreakfast * (1 + mealRules.dinnerValue);
          }
        } else {
          // Valores por defecto
          withBreakfast = Math.round(dynamicRate * 1.15);
          withHalfBoard = Math.round(dynamicRate * 1.35);
        }
        
        // Crear o actualizar tarifa
        await prisma.dailyRoomRate.upsert({
          where: {
            hotelId_roomTypeId_date: {
              hotelId: 'default-hotel',
              roomTypeId: roomType.id,
              date: currentDate
            }
          },
          update: {
            baseRate: baseRate, // Precio base puro de la curva estacional
            dynamicRate: dynamicRate,
            withBreakfast: Math.round(withBreakfast),
            withHalfBoard: Math.round(withHalfBoard)
          },
          create: {
            hotelId: 'default-hotel',
            roomTypeId: roomType.id,
            date: currentDate,
            baseRate: baseRate, // Precio base puro de la curva estacional
            dynamicRate: dynamicRate,
            withBreakfast: Math.round(withBreakfast),
            withHalfBoard: Math.round(withHalfBoard)
          }
        });
      }
    }
    
    console.log('✅ Tarifas regeneradas exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAndRegenerateRates(); 