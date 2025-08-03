const { PrismaClient } = require('@prisma/client');
const dynamicPricingService = require('../src/services/dynamicPricingService');

const prisma = new PrismaClient();

async function testRealAnticipation() {
  console.log('=== Prueba de Anticipación con Fechas Reales ===\n');

  // Fecha actual
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log('Fecha actual:', today.toISOString().split('T')[0]);
  console.log('Hora actual:', new Date().toISOString());
  console.log('');

  // Fechas de prueba
  const testDates = [
    { date: new Date(today.getTime() + 0 * 24 * 60 * 60 * 1000), description: 'Hoy' },
    { date: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), description: 'Mañana' },
    { date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), description: 'Pasado mañana' },
    { date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), description: 'Ayer' },
    { date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), description: 'Anteayer' }
  ];

  for (const testCase of testDates) {
    // Normalizar la fecha objetivo
    const targetDate = new Date(testCase.date);
    targetDate.setHours(0, 0, 0, 0);
    
    // Calcular días hasta la fecha (como lo hace el backend)
    const daysUntilDate = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    
    // Calcular factor de anticipación
    const anticipationFactor = dynamicPricingService.calculateContinuousAnticipation(daysUntilDate, 30);
    
    console.log(`${testCase.description} (${targetDate.toISOString().split('T')[0]}):`);
    console.log(`  Días hasta la fecha: ${daysUntilDate}`);
    console.log(`  Factor de anticipación: ${anticipationFactor.toFixed(4)} (${(anticipationFactor * 100).toFixed(2)}%)`);
    console.log('');
  }

  // Probar el cálculo del score completo
  console.log('=== Prueba del Score Completo ===\n');
  
  const config = {
    anticipationMode: 'CONTINUO',
    anticipationMaxDays: 30,
    anticipationWeight: 0.25,
    globalOccupancyWeight: 0.25,
    isWeekendWeight: 0.15,
    isHolidayWeight: 0.10,
    demandIndexWeight: 0.15,
    weatherScoreWeight: 0.05,
    eventImpactWeight: 0.05
  };

  for (const testCase of testDates) {
    const targetDate = new Date(testCase.date);
    targetDate.setHours(0, 0, 0, 0);
    const daysUntilDate = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    
    // Simular el cálculo del score
    const anticipationFactor = dynamicPricingService.calculateContinuousAnticipation(daysUntilDate, config.anticipationMaxDays);
    
    let score = 0;
    if (anticipationFactor > 0) {
      score = (
        anticipationFactor * config.anticipationWeight +
        0.5 * config.globalOccupancyWeight +
        0 * config.isWeekendWeight +
        0 * config.isHolidayWeight +
        0.5 * config.demandIndexWeight +
        0.5 * config.weatherScoreWeight +
        0.5 * config.eventImpactWeight
      );
      score = Math.max(0, Math.min(1, score));
    }
    
    console.log(`${testCase.description}:`);
    console.log(`  Días: ${daysUntilDate}, Anticipación: ${(anticipationFactor * 100).toFixed(2)}%, Score: ${(score * 100).toFixed(2)}%`);
  }

  await prisma.$disconnect();
}

testRealAnticipation().catch(console.error); 