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
        enabled: false,
        anticipationWeight: 0.2,
        globalOccupancyWeight: 0.25,
        isWeekendWeight: 0.15,
        weekendDays: [0, 6],
        isHolidayWeight: 0.1,
        weatherScoreWeight: 0.05,
        eventImpactWeight: 0.1,
        maxAdjustmentPercentage: 0.4,
        enableGapPromos: true,
        enableWeatherApi: false,
        enableRecentDemand: false,
        anticipationMode: 'ESCALONADO',
        anticipationMaxDays: 30,
        anticipationSteps: [
          { days: 21, weight: 1.0 },
          { days: 14, weight: 0.7 },
          { days: 7, weight: 0.4 },
          { days: 3, weight: 0.2 }
        ]
      }
    });
    console.log('✅ Configuración creada:', defaultConfig.id);

    console.log('✅ Migración completada exitosamente!');
    console.log('\n📝 Resumen de la migración:');
    console.log('- Configuración de precios dinámicos creada');
    console.log('\n🔧 Próximos pasos:');
    console.log('1. Revisar y ajustar la configuración según tus necesidades');
    console.log('2. Configurar el frontend para usar las nuevas APIs');

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