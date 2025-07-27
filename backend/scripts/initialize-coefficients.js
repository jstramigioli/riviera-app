const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initializeCoefficients() {
  try {
    console.log('🚀 Inicializando coeficientes de tipos de habitación...');

    // Coeficientes por defecto
    const defaultCoefficients = {
      'single': 0.62,
      'doble': 1.00,
      'triple': 1.25,
      'cuadruple': 1.50,
      'quintuple': 1.75
    };

    // Actualizar cada tipo de habitación con su coeficiente
    for (const [roomTypeName, coefficient] of Object.entries(defaultCoefficients)) {
      await prisma.roomType.updateMany({
        where: { name: roomTypeName },
        data: { multiplier: coefficient }
      });
      
      console.log(`✅ Coeficiente actualizado para ${roomTypeName}: ${coefficient}`);
    }

    console.log('✅ Coeficientes inicializados exitosamente');
  } catch (error) {
    console.error('❌ Error al inicializar coeficientes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeCoefficients(); 