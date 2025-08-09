const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixMealRules() {
  try {
    console.log('Arreglando reglas de comidas...');
    
    // Buscar las reglas de comidas existentes
    const existingRules = await prisma.mealPricingRule.findMany({
      where: { hotelId: 'default-hotel' }
    });
    
    console.log('Reglas existentes:', existingRules.length);
    
    if (existingRules.length > 0) {
      // Actualizar las reglas existentes con valores más razonables
      for (const rule of existingRules) {
        await prisma.mealPricingRule.update({
          where: { id: rule.id },
          data: {
            breakfastMode: 'FIXED',
            breakfastValue: 15000, // $15,000 fijos
            dinnerMode: 'FIXED',
            dinnerValue: 25000, // $25,000 fijos
          }
        });
        console.log(`Regla actualizada: ${rule.id}`);
      }
    } else {
      // Crear nuevas reglas si no existen
      await prisma.mealPricingRule.create({
        data: {
          hotelId: 'default-hotel',
          breakfastMode: 'FIXED',
          breakfastValue: 15000,
          dinnerMode: 'FIXED',
          dinnerValue: 25000,
        }
      });
      console.log('Nuevas reglas de comidas creadas');
    }
    
    console.log('Reglas de comidas arregladas exitosamente');
    
    // Mostrar las reglas actualizadas
    const updatedRules = await prisma.mealPricingRule.findMany({
      where: { hotelId: 'default-hotel' }
    });
    
    console.log('Reglas actualizadas:');
    updatedRules.forEach(rule => {
      console.log(`- Desayuno: ${rule.breakfastMode} ${rule.breakfastValue}`);
      console.log(`- Cena: ${rule.dinnerMode} ${rule.dinnerValue}`);
    });
    
  } catch (error) {
    console.error('Error arreglando reglas de comidas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMealRules(); 