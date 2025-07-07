const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importDatabase() {
  try {
    console.log('🔄 Importando datos a la base de datos...');
    
    const dataDir = path.join(__dirname, '../data');
    
    if (!fs.existsSync(dataDir)) {
      console.error('❌ No se encontró el directorio de datos. Ejecuta primero export-database.js');
      return;
    }

    // Leer metadatos
    const metadataPath = path.join(dataDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      console.log(`📊 Datos exportados el: ${metadata.exportedAt}`);
      console.log(`📈 Total de registros: ${metadata.totalRecords}`);
    }

    // Orden de importación para respetar las relaciones
    const importOrder = [
      'tags',
      'roomTypes', 
      'rooms',
      'clients',
      'guests',
      'payments',
      'reservations',
      'dailyRates'
    ];

    for (const modelName of importOrder) {
      const filePath = path.join(dataDir, `${modelName}.json`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  No se encontró ${modelName}.json, saltando...`);
        continue;
      }

      console.log(`📦 Importando ${modelName}...`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (data.length === 0) {
        console.log(`ℹ️  ${modelName}: No hay datos para importar`);
        continue;
      }

      // Importar según el modelo
      switch (modelName) {
        case 'tags':
          for (const tag of data) {
            await prisma.tag.upsert({
              where: { id: tag.id },
              update: tag,
              create: tag
            });
          }
          break;

        case 'roomTypes':
          for (const roomType of data) {
            await prisma.roomType.upsert({
              where: { id: roomType.id },
              update: roomType,
              create: roomType
            });
          }
          break;

        case 'rooms':
          for (const room of data) {
            const { tags, ...roomData } = room;
            await prisma.room.upsert({
              where: { id: room.id },
              update: roomData,
              create: roomData
            });
            
            // Actualizar tags si existen
            if (tags && tags.length > 0) {
              await prisma.room.update({
                where: { id: room.id },
                data: {
                  tags: {
                    connect: tags.map(tag => ({ id: tag.id }))
                  }
                }
              });
            }
          }
          break;

        case 'clients':
          for (const client of data) {
            await prisma.client.upsert({
              where: { id: client.id },
              update: client,
              create: client
            });
          }
          break;

        case 'guests':
          for (const guest of data) {
            await prisma.guest.upsert({
              where: { id: guest.id },
              update: guest,
              create: guest
            });
          }
          break;

        case 'payments':
          for (const payment of data) {
            await prisma.payment.upsert({
              where: { id: payment.id },
              update: payment,
              create: payment
            });
          }
          break;

        case 'reservations':
          for (const reservation of data) {
            const { guests, room, mainClient, ...reservationData } = reservation;
            await prisma.reservation.upsert({
              where: { id: reservation.id },
              update: reservationData,
              create: reservationData
            });
          }
          break;

        case 'dailyRates':
          for (const rate of data) {
            await prisma.dailyRate.upsert({
              where: { id: rate.id },
              update: rate,
              create: rate
            });
          }
          break;
      }

      console.log(`✅ ${modelName}: ${data.length} registros importados`);
    }

    console.log('🎉 Importación completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la importación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  importDatabase();
}

module.exports = { importDatabase }; 