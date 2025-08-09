const { PrismaClient } = require('@prisma/client');
const DynamicPricingService = require('../src/services/dynamicPricingService').DynamicPricingService;

const prisma = new PrismaClient();
const dynamicPricingService = new DynamicPricingService(prisma);

async function testHolidayPricing() {
  try {
    console.log('🧪 Probando cálculo de precios con feriado...\n');

    const hotelId = 'default-hotel';
    const testDate = new Date('2025-08-15'); // El feriado que agregaste
    const roomTypeId = 1; // Tipo de habitación estándar

    console.log(`📅 Fecha de prueba: ${testDate.toISOString().split('T')[0]}`);
    console.log(`🏨 Hotel ID: ${hotelId}`);
    console.log(`🛏️ Room Type ID: ${roomTypeId}\n`);

    // 1. Verificar si el día es feriado
    console.log('1️⃣ Verificando si el día es feriado...');
    const openDay = await prisma.openDay.findUnique({
      where: {
        hotelId_date: {
          hotelId,
          date: testDate
        }
      }
    });

    if (openDay) {
      console.log(`✅ Día encontrado en OpenDay`);
      console.log(`   isHoliday: ${openDay.isHoliday}`);
      console.log(`   isClosed: ${openDay.isClosed}`);
      console.log(`   Nombre: ${openDay.notes || 'Sin nombre'}`);
    } else {
      console.log(`❌ Día NO encontrado en OpenDay`);
    }

    // 2. Obtener configuración de precios dinámicos
    console.log('\n2️⃣ Obteniendo configuración de precios dinámicos...');
    const config = await prisma.dynamicPricingConfig.findUnique({
      where: { hotelId }
    });

    if (config) {
      console.log(`✅ Configuración encontrada`);
      console.log(`   Habilitado: ${config.enabled}`);
      console.log(`   Peso feriados: ${config.isHolidayWeight}`);
      console.log(`   Días fin de semana: ${config.weekendDays.join(', ')}`);
    } else {
      console.log(`❌ Configuración NO encontrada`);
    }

    // 3. Calcular occupancy score
    console.log('\n3️⃣ Calculando occupancy score...');
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const daysUntilDate = Math.ceil((testDate - currentDate) / (1000 * 60 * 60 * 24));
    
    const weekendDays = config?.weekendDays || [0, 6];
    const isWeekend = weekendDays.includes(testDate.getDay());
    const isHoliday = openDay?.isHoliday || false;

    console.log(`   Días hasta la fecha: ${daysUntilDate}`);
    console.log(`   Es fin de semana: ${isWeekend}`);
    console.log(`   Es feriado: ${isHoliday}`);

    const occupancyScore = await dynamicPricingService.calculateExpectedOccupancyScore({
      date: testDate,
      hotelId,
      daysUntilDate,
      currentOccupancy: 50,
      isWeekend,
      isHoliday
    });

    console.log(`   Occupancy Score: ${occupancyScore}`);

    // 4. Calcular precio base
    console.log('\n4️⃣ Calculando precio base...');
    const baseRate = await dynamicPricingService.interpolateBasePrice(testDate, hotelId);
    console.log(`   Precio base: $${(baseRate / 100).toFixed(2)} USD`);

    // 5. Aplicar ajuste dinámico
    console.log('\n5️⃣ Aplicando ajuste dinámico...');
    const dynamicRate = config && config.enabled
      ? dynamicPricingService.applyDynamicAdjustment(baseRate, occupancyScore, config)
      : baseRate;

    console.log(`   Precio dinámico: $${(dynamicRate / 100).toFixed(2)} USD`);
    console.log(`   Diferencia: $${((dynamicRate - baseRate) / 100).toFixed(2)} USD`);

    // 6. Verificar tarifas generadas
    console.log('\n6️⃣ Verificando tarifas generadas...');
    const existingRate = await prisma.dailyRoomRate.findUnique({
      where: {
        hotelId_roomTypeId_date: {
          hotelId,
          roomTypeId,
          date: testDate
        }
      }
    });

    if (existingRate) {
      console.log(`✅ Tarifa encontrada en DailyRoomRate`);
      console.log(`   Precio base: $${(existingRate.baseRate / 100).toFixed(2)} USD`);
      console.log(`   Precio dinámico: $${(existingRate.dynamicRate / 100).toFixed(2)} USD`);
    } else {
      console.log(`❌ Tarifa NO encontrada en DailyRoomRate`);
    }

    // 7. Generar tarifas para el rango
    console.log('\n7️⃣ Generando tarifas para el rango...');
    const startDate = new Date('2025-08-14');
    const endDate = new Date('2025-08-16');
    
    console.log(`   Rango: ${startDate.toISOString().split('T')[0]} a ${endDate.toISOString().split('T')[0]}`);
    
    const rates = await dynamicPricingService.generateDynamicRates(hotelId, roomTypeId, startDate, endDate);
    
    console.log(`   Tarifas generadas: ${rates.length}`);
    rates.forEach((rate, index) => {
      const date = new Date(rate.date);
      const isHolidayDate = date.toISOString().split('T')[0] === '2025-08-15';
      console.log(`   ${index + 1}. ${date.toISOString().split('T')[0]} - $${(rate.dynamicRate / 100).toFixed(2)} USD${isHolidayDate ? ' 🎉 FERIADO' : ''}`);
    });

  } catch (error) {
    console.error('❌ Error al probar precios con feriado:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testHolidayPricing(); 