const { PrismaClient } = require('@prisma/client');
const dynamicPricingService = require('../src/services/dynamicPricingService');

const prisma = new PrismaClient();

async function testNewPricingSystem() {
  try {
    console.log('=== PRUEBA DEL NUEVO SISTEMA DE PRECIOS DINÁMICOS ===\n');

    const hotelId = 'default-hotel';
    const testDate = new Date('2024-12-25'); // Navidad
    const daysUntilDate = 30;
    const currentOccupancy = 85; // 85% de ocupación

    console.log('Parámetros de prueba:');
    console.log('- Hotel ID:', hotelId);
    console.log('- Fecha:', testDate.toISOString().split('T')[0]);
    console.log('- Días hasta la fecha:', daysUntilDate);
    console.log('- Ocupación actual:', currentOccupancy + '%');
    console.log('- Es fin de semana:', testDate.getDay() === 0 || testDate.getDay() === 6);
    console.log('');

    // 1. Obtener configuración actual
    console.log('1. Obteniendo configuración actual...');
    const config = await prisma.dynamicPricingConfig.findUnique({
      where: { hotelId }
    });

    if (!config) {
      console.log('No se encontró configuración. Creando configuración por defecto...');
      // Crear configuración por defecto
      await prisma.dynamicPricingConfig.create({
        data: {
          hotelId,
          enabled: true,
          standardRate: 80000,
          idealOccupancy: 80.0,
          occupancyAdjustmentPercentage: 20.0,
          anticipationAdjustmentPercentage: 15.0,
          weekendAdjustmentPercentage: 10.0,
          holidayAdjustmentPercentage: 25.0,
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
    }

    console.log('Configuración obtenida:', {
      standardRate: config?.standardRate,
      idealOccupancy: config?.idealOccupancy,
      occupancyAdjustmentPercentage: config?.occupancyAdjustmentPercentage,
      anticipationAdjustmentPercentage: config?.anticipationAdjustmentPercentage,
      weekendAdjustmentPercentage: config?.weekendAdjustmentPercentage,
      holidayAdjustmentPercentage: config?.holidayAdjustmentPercentage
    });
    console.log('');

    // 2. Calcular porcentajes de ajuste individuales
    console.log('2. Calculando porcentajes de ajuste individuales...');
    const adjustmentPercentages = await dynamicPricingService.calculateIndividualAdjustmentPercentages({
      date: testDate,
      hotelId,
      daysUntilDate,
      currentOccupancy,
      isWeekend: testDate.getDay() === 0 || testDate.getDay() === 6,
      isHoliday: false
    });

    console.log('Porcentajes de ajuste calculados:');
    console.log('- Ajuste por ocupación:', (adjustmentPercentages.occupancyAdjustment * 100).toFixed(2) + '%');
    console.log('- Ajuste por anticipación:', (adjustmentPercentages.anticipationAdjustment * 100).toFixed(2) + '%');
    console.log('- Ajuste por fin de semana:', (adjustmentPercentages.weekendAdjustment * 100).toFixed(2) + '%');
    console.log('- Ajuste por feriados:', (adjustmentPercentages.holidayAdjustment * 100).toFixed(2) + '%');
    console.log('- Ajuste total:', (adjustmentPercentages.totalAdjustment * 100).toFixed(2) + '%');
    console.log('');

    // 3. Calcular precio base
    console.log('3. Calculando precio base...');
    const basePrice = await dynamicPricingService.interpolateBasePrice(testDate, hotelId);
    console.log('Precio base:', basePrice);
    console.log('');

    // 4. Aplicar ajuste dinámico
    console.log('4. Aplicando ajuste dinámico...');
    const finalPrice = dynamicPricingService.applyDynamicAdjustment(basePrice, adjustmentPercentages, config);
    console.log('Precio final:', finalPrice);
    console.log('Diferencia:', finalPrice - basePrice);
    console.log('Porcentaje de cambio:', (((finalPrice - basePrice) / basePrice) * 100).toFixed(2) + '%');
    console.log('');

    // 5. Verificar límites
    console.log('5. Verificando límites...');
    
    // Calcular máximos dinámicamente
    const maxDiscountFactors = [
      config.occupancyAdjustmentPercentage,
      config.anticipationAdjustmentPercentage
    ];
    const maxIncreaseFactors = [
      config.occupancyAdjustmentPercentage,
      config.anticipationAdjustmentPercentage,
      config.weekendAdjustmentPercentage,
      config.holidayAdjustmentPercentage
    ];
    
    const maxDiscount = maxDiscountFactors.reduce((sum, factor) => sum + factor, 0) / 100;
    const maxIncrease = maxIncreaseFactors.reduce((sum, factor) => sum + factor, 0) / 100;
    const clampedAdjustment = Math.max(-maxDiscount, Math.min(maxIncrease, adjustmentPercentages.totalAdjustment));
    
    console.log('Límites calculados dinámicamente:');
    console.log('- Máximo descuento:', (maxDiscount * 100).toFixed(1) + '%');
    console.log('- Máximo recargo:', (maxIncrease * 100).toFixed(1) + '%');
    console.log('Ajuste aplicado:', (clampedAdjustment * 100).toFixed(2) + '%');
    console.log('');

    // 6. Mostrar desglose detallado
    console.log('6. Desglose detallado:');
    console.log('Precio base:', basePrice);
    console.log('Ajuste por ocupación:', basePrice * adjustmentPercentages.occupancyAdjustment);
    console.log('Ajuste por anticipación:', basePrice * adjustmentPercentages.anticipationAdjustment);
    console.log('Ajuste por fin de semana:', basePrice * adjustmentPercentages.weekendAdjustment);
    console.log('Ajuste por feriados:', basePrice * adjustmentPercentages.holidayAdjustment);
    console.log('Precio final:', finalPrice);
    console.log('');

    console.log('=== PRUEBA COMPLETADA ===');

  } catch (error) {
    console.error('Error en la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewPricingSystem(); 