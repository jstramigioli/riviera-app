const { PrismaClient } = require('@prisma/client');
const dynamicPricingService = require('../src/services/dynamicPricingService');

const prisma = new PrismaClient();

async function testAnticipationCalculation() {
  console.log('=== Prueba de Cálculo de Anticipación ===\n');

  // Configuración de prueba
  const config = {
    anticipationWeight: 0.3,
    globalOccupancyWeight: 0.25,
    isWeekendWeight: 0.15,
    isHolidayWeight: 0.1,
    weatherScoreWeight: 0.05,
    eventImpactWeight: 0.05,
    maxAdjustmentPercentage: 0.4
  };

  // Simular cálculo manual
  const manualScore = (
    0.8 * config.anticipationWeight +
    0.6 * config.globalOccupancyWeight +
    1.0 * config.isWeekendWeight +
    0.0 * config.isHolidayWeight +
    0.5 * config.weatherScoreWeight +
    0.5 * config.eventImpactWeight
  );

  // Fechas de prueba
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const testDates = [
    { date: new Date(today.getTime() + 0 * 24 * 60 * 60 * 1000), description: 'Hoy (0 días)' },
    { date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), description: 'Mañana (1 día)' },
    { date: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000), description: 'En 15 días' },
    { date: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), description: 'En 30 días' },
    { date: new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000), description: 'En 45 días' },
    { date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), description: 'Ayer (-1 día)' }
  ];

  console.log('Fecha actual:', today.toISOString().split('T')[0]);
  console.log('Configuración:', config);
  console.log('\n--- Resultados ---\n');

  for (const testCase of testDates) {
    const daysUntilDate = Math.ceil((testCase.date - today) / (1000 * 60 * 60 * 24));
    const anticipationFactor = dynamicPricingService.calculateContinuousAnticipation(daysUntilDate, config.anticipationMaxDays);
    
    console.log(`${testCase.description}:`);
    console.log(`  Días hasta la fecha: ${daysUntilDate}`);
    console.log(`  Factor de anticipación: ${anticipationFactor.toFixed(4)} (${(anticipationFactor * 100).toFixed(2)}%)`);
    
    // Simular el cálculo del score sin llamar a la base de datos
    let score = 0;
    if (anticipationFactor > 0) {
      score = (
        anticipationFactor * config.anticipationWeight +
        0.5 * config.globalOccupancyWeight +
        0 * config.isWeekendWeight +
        0 * config.isHolidayWeight +
        0.5 * config.weatherScoreWeight +
        0.5 * config.eventImpactWeight
      );
      score = Math.max(0, Math.min(1, score));
    }
    
    console.log(`  Score final: ${score.toFixed(4)} (${(score * 100).toFixed(2)}%)`);
    console.log('');
  }

  await prisma.$disconnect();
}

testAnticipationCalculation().catch(console.error); 