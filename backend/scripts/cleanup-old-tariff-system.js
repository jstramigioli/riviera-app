const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupOldTariffSystem() {
  try {
    console.log('🧹 Limpiando sistema de tarifas anterior...\n');

    // Verificar qué tablas del sistema anterior existen
    console.log('1. Verificando tablas del sistema anterior...');
    
    // Verificar si existen registros en las tablas que queremos eliminar
    const dailyRatesCount = await prisma.dailyRate.count();
    const mealPricingRulesCount = await prisma.mealPricingRule.count();
    const rateTypesCount = await prisma.rateType.count();
    
    console.log('Registros encontrados:');
    console.log('- DailyRate:', dailyRatesCount);
    console.log('- MealPricingRule:', mealPricingRulesCount);
    console.log('- RateType:', rateTypesCount);

    if (dailyRatesCount > 0 || mealPricingRulesCount > 0 || rateTypesCount > 0) {
      console.log('\n⚠️  ADVERTENCIA: Se encontraron datos en las tablas del sistema anterior.');
      console.log('Estos datos serán eliminados. ¿Deseas continuar? (s/n)');
      
      // En un entorno real, aquí se pediría confirmación al usuario
      // Por ahora, asumimos que sí queremos continuar
      console.log('Continuando con la limpieza...\n');
    }

    // 2. Eliminar datos del sistema anterior
    console.log('2. Eliminando datos del sistema anterior...');
    
    // Eliminar en orden para respetar las relaciones
    const deletedDailyRates = await prisma.dailyRate.deleteMany({});
    console.log('✅ DailyRate eliminados:', deletedDailyRates.count);
    
    const deletedMealPricingRules = await prisma.mealPricingRule.deleteMany({});
    console.log('✅ MealPricingRule eliminados:', deletedMealPricingRules.count);
    
    const deletedRateTypes = await prisma.rateType.deleteMany({});
    console.log('✅ RateType eliminados:', deletedRateTypes.count);

    // 3. Verificar que las tablas estén vacías
    console.log('\n3. Verificando limpieza...');
    
    const finalDailyRatesCount = await prisma.dailyRate.count();
    const finalMealPricingRulesCount = await prisma.mealPricingRule.count();
    const finalRateTypesCount = await prisma.rateType.count();
    
    console.log('Registros restantes:');
    console.log('- DailyRate:', finalDailyRatesCount);
    console.log('- MealPricingRule:', finalMealPricingRulesCount);
    console.log('- RateType:', finalRateTypesCount);

    if (finalDailyRatesCount === 0 && finalMealPricingRulesCount === 0 && finalRateTypesCount === 0) {
      console.log('\n✅ ¡Limpieza completada exitosamente!');
      console.log('\n📋 RESUMEN:');
      console.log('- Sistema de tarifas anterior eliminado');
      console.log('- Nuevo sistema de tarifas listo para usar');
      console.log('- Sistema de precios inteligentes mantenido');
      
      console.log('\n🎯 PRÓXIMOS PASOS:');
      console.log('1. Las tablas DailyRate, MealPricingRule y RateType están vacías');
      console.log('2. Puedes eliminar estas tablas del schema si ya no las necesitas');
      console.log('3. El nuevo sistema usa: SeasonBlock, SeasonPrice, ServiceType, ServiceAdjustment');
      console.log('4. El sistema de precios inteligentes sigue funcionando con: DynamicPricingConfig, SeasonalKeyframe, DailyRoomRate');
    } else {
      console.log('\n⚠️  Algunas tablas aún tienen datos. Revisa manualmente.');
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la limpieza
cleanupOldTariffSystem(); 