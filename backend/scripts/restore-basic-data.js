const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreBasicData() {
  try {
    console.log('🔄 Iniciando restauración de datos básicos...');
    
    // Ruta del backup
    const backupPath = path.join(__dirname, '../backups/backup_2025-09-02T22-59-43-571Z');
    
    if (!fs.existsSync(backupPath)) {
      console.error('❌ No se encontró el directorio de backup');
      return;
    }

    let totalRestored = 0;

    // 1. Restaurar hoteles (solo datos básicos)
    console.log('\n📦 Restaurando hoteles...');
    try {
      const hotelsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'hotels.json'), 'utf8'));
      let restored = 0;
      
      for (const hotel of hotelsData) {
        try {
          const { rooms, roomTypes, serviceTypes, seasonBlocks, ...hotelData } = hotel;
          await prisma.hotel.upsert({
            where: { id: hotel.id },
            update: hotelData,
            create: hotelData
          });
          restored++;
        } catch (error) {
          console.log(`❌ Error restaurando hotel ${hotel.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Hoteles: ${restored} registros restaurados`);
      totalRestored += restored;
    } catch (error) {
      console.error('❌ Error procesando hoteles:', error.message);
    }

    // 2. Restaurar tags
    console.log('\n📦 Restaurando tags...');
    try {
      const tagsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'tags.json'), 'utf8'));
      let restored = 0;
      
      for (const tag of tagsData) {
        try {
          await prisma.tag.upsert({
            where: { id: tag.id },
            update: tag,
            create: tag
          });
          restored++;
        } catch (error) {
          console.log(`❌ Error restaurando tag ${tag.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Tags: ${restored} registros restaurados`);
      totalRestored += restored;
    } catch (error) {
      console.error('❌ Error procesando tags:', error.message);
    }

    // 3. Restaurar tipos de habitación
    console.log('\n📦 Restaurando tipos de habitación...');
    try {
      const roomTypesData = JSON.parse(fs.readFileSync(path.join(backupPath, 'roomTypes.json'), 'utf8'));
      let restored = 0;
      
      for (const roomType of roomTypesData) {
        try {
          const { hotel, rooms, ...roomTypeData } = roomType;
          await prisma.roomType.upsert({
            where: { id: roomType.id },
            update: roomTypeData,
            create: roomTypeData
          });
          restored++;
        } catch (error) {
          console.log(`❌ Error restaurando roomType ${roomType.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Tipos de habitación: ${restored} registros restaurados`);
      totalRestored += restored;
    } catch (error) {
      console.error('❌ Error procesando tipos de habitación:', error.message);
    }

    // 4. Restaurar habitaciones (solo datos básicos)
    console.log('\n📦 Restaurando habitaciones...');
    try {
      const roomsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'rooms.json'), 'utf8'));
      let restored = 0;
      
      for (const room of roomsData) {
        try {
          const { tags, hotel, roomType, segments, gapPromotions, queries, ...roomData } = room;
          await prisma.room.upsert({
            where: { id: room.id },
            update: roomData,
            create: roomData
          });
          restored++;
        } catch (error) {
          console.log(`❌ Error restaurando room ${room.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Habitaciones: ${restored} registros restaurados`);
      totalRestored += restored;
    } catch (error) {
      console.error('❌ Error procesando habitaciones:', error.message);
    }

    // 5. Restaurar tipos de servicio
    console.log('\n📦 Restaurando tipos de servicio...');
    try {
      const serviceTypesData = JSON.parse(fs.readFileSync(path.join(backupPath, 'serviceTypes.json'), 'utf8'));
      let restored = 0;
      
      for (const serviceType of serviceTypesData) {
        try {
          const { hotel, seasonPrices, blockServiceSelections, ...serviceTypeData } = serviceType;
          await prisma.serviceType.upsert({
            where: { id: serviceType.id },
            update: serviceTypeData,
            create: serviceTypeData
          });
          restored++;
        } catch (error) {
          console.log(`❌ Error restaurando serviceType ${serviceType.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Tipos de servicio: ${restored} registros restaurados`);
      totalRestored += restored;
    } catch (error) {
      console.error('❌ Error procesando tipos de servicio:', error.message);
    }

    // 6. Restaurar bloques de temporada
    console.log('\n📦 Restaurando bloques de temporada...');
    try {
      const seasonBlocksData = JSON.parse(fs.readFileSync(path.join(backupPath, 'seasonBlocks.json'), 'utf8'));
      let restored = 0;
      
      for (const seasonBlock of seasonBlocksData) {
        try {
          const { hotel, seasonPrices, blockServiceSelections, proportionCoefficients, ...seasonBlockData } = seasonBlock;
          await prisma.seasonBlock.upsert({
            where: { id: seasonBlock.id },
            update: seasonBlockData,
            create: seasonBlockData
          });
          restored++;
        } catch (error) {
          console.log(`❌ Error restaurando seasonBlock ${seasonBlock.id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Bloques de temporada: ${restored} registros restaurados`);
      totalRestored += restored;
    } catch (error) {
      console.error('❌ Error procesando bloques de temporada:', error.message);
    }

    console.log(`\n🎉 Restauración completada! Total de registros restaurados: ${totalRestored}`);

  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  restoreBasicData();
}

module.exports = { restoreBasicData };
