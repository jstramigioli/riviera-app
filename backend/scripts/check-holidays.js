const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkHolidays() {
  try {
    console.log('🔍 Verificando feriados en la base de datos...\n');

    // Obtener todos los días de apertura que son feriados
    const holidays = await prisma.openDay.findMany({
      where: {
        isHoliday: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    console.log(`📊 Total de feriados encontrados: ${holidays.length}\n`);

    if (holidays.length === 0) {
      console.log('❌ No hay feriados configurados en la base de datos');
      return;
    }

    console.log('📋 Lista de feriados:');
    holidays.forEach((holiday, index) => {
      console.log(`${index + 1}. Fecha: ${holiday.date.toISOString().split('T')[0]}`);
      console.log(`   Hotel ID: ${holiday.hotelId}`);
      console.log(`   Nombre: ${holiday.notes || 'Sin nombre'}`);
      console.log(`   isHoliday: ${holiday.isHoliday}`);
      console.log(`   isClosed: ${holiday.isClosed}`);
      console.log(`   Precio fijo: ${holiday.fixedPrice ? `$${(holiday.fixedPrice / 100).toFixed(2)} USD` : 'No'}`);
      console.log('');
    });

    // Verificar configuración de precios dinámicos
    console.log('🔧 Verificando configuración de precios dinámicos...\n');

    const configs = await prisma.dynamicPricingConfig.findMany();
    console.log(`📊 Configuraciones encontradas: ${configs.length}`);

    configs.forEach((config, index) => {
      console.log(`${index + 1}. Hotel ID: ${config.hotelId}`);
      console.log(`   Habilitado: ${config.enabled}`);
      console.log(`   Peso feriados: ${config.isHolidayWeight}`);
      console.log(`   Días fin de semana: ${config.weekendDays.join(', ')}`);
      console.log('');
    });

    // Verificar hoteles
    console.log('🏨 Verificando hoteles...\n');

    const hotels = await prisma.hotel.findMany();
    console.log(`📊 Hoteles encontrados: ${hotels.length}`);

    hotels.forEach((hotel, index) => {
      console.log(`${index + 1}. ID: ${hotel.id}`);
      console.log(`   Nombre: ${hotel.name}`);
      console.log(`   Activo: ${hotel.isActive}`);
      console.log('');
    });

    // Probar consulta específica para un feriado
    if (holidays.length > 0) {
      const testHoliday = holidays[0];
      console.log('🧪 Probando consulta específica...\n');

      const testOpenDay = await prisma.openDay.findUnique({
        where: {
          hotelId_date: {
            hotelId: testHoliday.hotelId,
            date: testHoliday.date
          }
        }
      });

      console.log(`Test consulta para ${testHoliday.date.toISOString().split('T')[0]} en hotel ${testHoliday.hotelId}:`);
      console.log(`Resultado: ${testOpenDay ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
      if (testOpenDay) {
        console.log(`isHoliday: ${testOpenDay.isHoliday}`);
        console.log(`isClosed: ${testOpenDay.isClosed}`);
      }
    }

  } catch (error) {
    console.error('❌ Error al verificar feriados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkHolidays(); 