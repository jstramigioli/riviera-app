const { PrismaClient } = require('@prisma/client');
const dynamicPricingService = require('../src/services/dynamicPricingService');

const prisma = new PrismaClient();

async function migrateToDynamicPricing() {
  try {
    console.log('🚀 Iniciando migración al sistema de tarifas dinámicas...');

    // 1. Crear configuración por defecto para el hotel
    const hotelId = 'default-hotel'; // Puedes cambiar esto según tu configuración
    
    console.log('📋 Creando configuración por defecto...');
    const defaultConfig = await prisma.dynamicPricingConfig.upsert({
      where: { hotelId },
      update: {},
      create: {
        hotelId,
        anticipationThresholds: [21, 14, 7, 3],
        anticipationWeight: 0.3,
        globalOccupancyWeight: 0.25,
        isWeekendWeight: 0.15,
        isHolidayWeight: 0.1,
        demandIndexWeight: 0.1,
        weatherScoreWeight: 0.05,
        eventImpactWeight: 0.05,
        maxAdjustmentPercentage: 0.4
      }
    });
    console.log('✅ Configuración creada:', defaultConfig.id);

    // 2. Crear keyframes estacionales basados en datos existentes
    console.log('📊 Analizando datos existentes para crear keyframes...');
    
    // Obtener todas las tarifas existentes
    const existingRates = await prisma.dailyRate.findMany({
      include: {
        roomType: true
      },
      orderBy: { date: 'asc' }
    });

    if (existingRates.length > 0) {
      // Agrupar por mes para crear keyframes estacionales
      const monthlyAverages = {};
      
      existingRates.forEach(rate => {
        const month = new Date(rate.date).getMonth();
        if (!monthlyAverages[month]) {
          monthlyAverages[month] = [];
        }
        monthlyAverages[month].push(rate.price);
      });

      // Crear keyframes para cada mes con datos
      for (const [month, prices] of Object.entries(monthlyAverages)) {
        const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const date = new Date(2024, parseInt(month), 15); // Día 15 de cada mes
        
        await prisma.seasonalKeyframe.create({
          data: {
            hotelId,
            date,
            basePrice: averagePrice
          }
        });
        
        console.log(`✅ Keyframe creado para mes ${parseInt(month) + 1}: $${averagePrice}`);
      }
    } else {
      // Crear keyframes por defecto si no hay datos
      console.log('📅 Creando keyframes por defecto...');
      const defaultKeyframes = [
        { month: 0, price: 8000 },   // Enero
        { month: 1, price: 7500 },   // Febrero
        { month: 2, price: 7000 },   // Marzo
        { month: 3, price: 6500 },   // Abril
        { month: 4, price: 6000 },   // Mayo
        { month: 5, price: 5500 },   // Junio
        { month: 6, price: 6000 },   // Julio
        { month: 7, price: 6500 },   // Agosto
        { month: 8, price: 7000 },   // Septiembre
        { month: 9, price: 7500 },   // Octubre
        { month: 10, price: 8000 },  // Noviembre
        { month: 11, price: 8500 }   // Diciembre
      ];

      for (const keyframe of defaultKeyframes) {
        await prisma.seasonalKeyframe.create({
          data: {
            hotelId,
            date: new Date(2024, keyframe.month, 15),
            basePrice: keyframe.price
          }
        });
        console.log(`✅ Keyframe creado para mes ${keyframe.month + 1}: $${keyframe.price}`);
      }
    }

    // 3. Crear reglas de precios de comidas por defecto
    console.log('🍽️ Creando reglas de precios de comidas...');
    await prisma.mealPricingRule.upsert({
      where: { hotelId },
      update: {},
      create: {
        hotelId,
        breakfastMode: 'PERCENTAGE',
        breakfastValue: 0.15, // 15% más por desayuno
        dinnerMode: 'PERCENTAGE',
        dinnerValue: 0.20  // 20% más por cena
      }
    });
    console.log('✅ Reglas de comidas creadas');

    // 4. Generar tarifas dinámicas para los próximos 6 meses
    console.log('💰 Generando tarifas dinámicas...');
    const roomTypes = await prisma.roomType.findMany();
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6);

    for (const roomType of roomTypes) {
      console.log(`📈 Generando tarifas para tipo: ${roomType.name}`);
      await dynamicPricingService.generateDynamicRates(
        hotelId,
        roomType.id,
        startDate,
        endDate
      );
    }

    console.log('✅ Migración completada exitosamente!');
    console.log('\n📝 Resumen de la migración:');
    console.log('- Configuración de precios dinámicos creada');
    console.log('- Keyframes estacionales generados');
    console.log('- Reglas de comidas configuradas');
    console.log('- Tarifas dinámicas generadas para los próximos 6 meses');
    console.log('\n🔧 Próximos pasos:');
    console.log('1. Revisar y ajustar la configuración según tus necesidades');
    console.log('2. Modificar los keyframes estacionales según tu temporada');
    console.log('3. Ajustar las reglas de precios de comidas');
    console.log('4. Actualizar el frontend para usar las nuevas APIs');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración si se llama directamente
if (require.main === module) {
  migrateToDynamicPricing()
    .then(() => {
      console.log('🎉 Migración completada!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error en la migración:', error);
      process.exit(1);
    });
}

module.exports = { migrateToDynamicPricing }; 