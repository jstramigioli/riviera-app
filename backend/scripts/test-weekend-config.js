const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testWeekendConfig() {
  try {
    console.log('=== Prueba de configuración de días de fin de semana ===');
    
    // 1. Verificar configuración actual
    const currentConfig = await prisma.dynamicPricingConfig.findUnique({
      where: { hotelId: 'default-hotel' }
    });
    
    console.log('Configuración actual:', {
      weekendDays: currentConfig?.weekendDays,
      isWeekendWeight: currentConfig?.isWeekendWeight
    });
    
    // 2. Probar cambio a Sábado y Domingo
    console.log('\n=== Probando cambio a Sábado y Domingo ===');
    const saturdaySundayConfig = await prisma.dynamicPricingConfig.update({
      where: { hotelId: 'default-hotel' },
      data: {
        weekendDays: [0, 6] // Sábado y Domingo
      }
    });
    
    console.log('Configuración actualizada a Sábado y Domingo:', {
      weekendDays: saturdaySundayConfig.weekendDays
    });
    
    // 3. Probar cambio a Viernes, Sábado y Domingo
    console.log('\n=== Probando cambio a Viernes, Sábado y Domingo ===');
    const fridaySaturdaySundayConfig = await prisma.dynamicPricingConfig.update({
      where: { hotelId: 'default-hotel' },
      data: {
        weekendDays: [0, 5, 6] // Viernes, Sábado y Domingo
      }
    });
    
    console.log('Configuración actualizada a Viernes, Sábado y Domingo:', {
      weekendDays: fridaySaturdaySundayConfig.weekendDays
    });
    
    // 4. Probar volver a Sábado y Domingo
    console.log('\n=== Probando volver a Sábado y Domingo ===');
    const backToSaturdaySundayConfig = await prisma.dynamicPricingConfig.update({
      where: { hotelId: 'default-hotel' },
      data: {
        weekendDays: [0, 6] // Sábado y Domingo
      }
    });
    
    console.log('Configuración vuelta a Sábado y Domingo:', {
      weekendDays: backToSaturdaySundayConfig.weekendDays
    });
    
    // 5. Probar diferentes fechas
    const testDates = [
      new Date('2024-01-05'), // Viernes
      new Date('2024-01-06'), // Sábado
      new Date('2024-01-07'), // Domingo
      new Date('2024-01-08'), // Lunes
    ];
    
    console.log('\n=== Prueba de detección de fin de semana ===');
    for (const date of testDates) {
      const dayOfWeek = date.getDay();
      const isWeekend = backToSaturdaySundayConfig.weekendDays.includes(dayOfWeek);
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      console.log(`${date.toDateString()} (${dayNames[dayOfWeek]}): ${isWeekend ? 'FIN DE SEMANA' : 'Día normal'}`);
    }
    
    // 6. Restaurar configuración original
    console.log('\n=== Restaurando configuración original ===');
    await prisma.dynamicPricingConfig.update({
      where: { hotelId: 'default-hotel' },
      data: {
        weekendDays: [0, 5, 6] // Viernes, Sábado y Domingo (configuración original)
      }
    });
    
    console.log('Configuración restaurada a Viernes, Sábado y Domingo');
    
  } catch (error) {
    console.error('Error en la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWeekendConfig(); 