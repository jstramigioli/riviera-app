const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function increaseHolidayWeight() {
  try {
    console.log('🔧 Aumentando el peso de feriados/fines de semana largos...\n');

    // Actualizar la configuración para aumentar el peso de feriados/fines de semana largos
    const updatedConfig = await prisma.dynamicPricingConfig.update({
      where: { hotelId: 'default-hotel' },
      data: {
        isHolidayWeight: 0.3 // Aumentar de 0.1 a 0.3 (30% de influencia)
      }
    });

    console.log('✅ Configuración actualizada:');
    console.log(`   Hotel ID: ${updatedConfig.hotelId}`);
    console.log(`   Peso feriados/fines de semana largos: ${updatedConfig.isHolidayWeight} (antes era 0.1)`);
    console.log(`   Habilitado: ${updatedConfig.enabled}`);

    console.log('\n🎯 Ahora el efecto de los feriados/fines de semana largos será más notable en los precios.');

  } catch (error) {
    console.error('❌ Error al actualizar configuración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

increaseHolidayWeight(); 