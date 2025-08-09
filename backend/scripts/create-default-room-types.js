const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createDefaultRoomTypes() {
  try {
    console.log('Verificando tipos de habitación existentes...');
    
    const existingRoomTypes = await prisma.roomType.findMany();
    console.log('Tipos de habitación existentes:', existingRoomTypes.length);
    
    if (existingRoomTypes.length === 0) {
      console.log('Creando tipos de habitación por defecto...');
      
      const defaultRoomTypes = [
        { name: 'Simple', description: 'Habitación individual', multiplier: 1.0, orderIndex: 0 },
        { name: 'Doble', description: 'Habitación doble', multiplier: 1.5, orderIndex: 1 },
        { name: 'Suite', description: 'Suite de lujo', multiplier: 2.0, orderIndex: 2 }
      ];
      
      for (const roomType of defaultRoomTypes) {
        await prisma.roomType.create({
          data: roomType
        });
        console.log(`Creado: ${roomType.name}`);
      }
      
      console.log('Tipos de habitación por defecto creados exitosamente');
    } else {
      console.log('Ya existen tipos de habitación en la base de datos');
      existingRoomTypes.forEach(rt => {
        console.log(`- ${rt.name} (multiplicador: ${rt.multiplier})`);
      });
    }
    
  } catch (error) {
    console.error('Error creando tipos de habitación por defecto:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultRoomTypes(); 