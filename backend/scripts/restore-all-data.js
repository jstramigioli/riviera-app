const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreAllData() {
  try {
    console.log('🔄 Iniciando restauración completa de todos los datos...');
    
    // Ruta del backup
    const backupPath = path.join(__dirname, '../backups/backup_2025-09-02T22-59-43-571Z');
    
    if (!fs.existsSync(backupPath)) {
      console.error('❌ No se encontró el directorio de backup');
      return;
    }

    // Leer metadatos del backup
    const metadataPath = path.join(backupPath, 'backup-metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      console.log(`📊 Backup creado el: ${metadata.backupCreatedAt}`);
      console.log(`📈 Total de registros: ${metadata.totalRecords}`);
    }

    // Orden de importación para respetar las relaciones
    const importOrder = [
      'hotels',
      'tags',
      'roomTypes', 
      'rooms',
      'serviceTypes',
      'seasonBlocks',
      'seasonPrices',
      'blockServiceSelections',
      'dynamicPricingConfigs',
      'guests',
      'payments',
      'reservations'
    ];

    let totalRestored = 0;

    for (const modelName of importOrder) {
      const filePath = path.join(backupPath, `${modelName}.json`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  No se encontró ${modelName}.json, saltando...`);
        continue;
      }

      console.log(`\n📦 Restaurando ${modelName}...`);
      
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.length === 0) {
          console.log(`ℹ️  ${modelName}: No hay datos para restaurar`);
          continue;
        }

        console.log(`📊 Procesando ${data.length} registros de ${modelName}...`);

        // Restaurar según el modelo
        let restored = 0;
        let errors = 0;

        switch (modelName) {
          case 'hotels':
            for (const hotel of data) {
              try {
                const { rooms, roomTypes, serviceTypes, seasonBlocks, ...hotelData } = hotel;
                await prisma.hotel.upsert({
                  where: { id: hotel.id },
                  update: hotelData,
                  create: hotelData
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando hotel ${hotel.id}: ${error.message}`);
              }
            }
            break;

          case 'tags':
            for (const tag of data) {
              try {
                await prisma.tag.upsert({
                  where: { id: tag.id },
                  update: tag,
                  create: tag
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando tag ${tag.id}: ${error.message}`);
              }
            }
            break;

          case 'roomTypes':
            for (const roomType of data) {
              try {
                const { hotel, rooms, ...roomTypeData } = roomType;
                await prisma.roomType.upsert({
                  where: { id: roomType.id },
                  update: roomTypeData,
                  create: roomTypeData
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando roomType ${roomType.id}: ${error.message}`);
              }
            }
            break;

          case 'rooms':
            for (const room of data) {
              try {
                const { tags, hotel, roomType, ...roomData } = room;
                await prisma.room.upsert({
                  where: { id: room.id },
                  update: roomData,
                  create: roomData
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando room ${room.id}: ${error.message}`);
              }
            }
            break;

          case 'serviceTypes':
            for (const serviceType of data) {
              try {
                const { hotel, seasonPrices, blockServiceSelections, ...serviceTypeData } = serviceType;
                await prisma.serviceType.upsert({
                  where: { id: serviceType.id },
                  update: serviceTypeData,
                  create: serviceTypeData
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando serviceType ${serviceType.id}: ${error.message}`);
              }
            }
            break;

          case 'seasonBlocks':
            for (const seasonBlock of data) {
              try {
                const { hotel, seasonPrices, blockServiceSelections, ...seasonBlockData } = seasonBlock;
                await prisma.seasonBlock.upsert({
                  where: { id: seasonBlock.id },
                  update: seasonBlockData,
                  create: seasonBlockData
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando seasonBlock ${seasonBlock.id}: ${error.message}`);
              }
            }
            break;

          case 'seasonPrices':
            for (const seasonPrice of data) {
              try {
                const { seasonBlock, roomType, serviceType, ...seasonPriceData } = seasonPrice;
                await prisma.seasonPrice.upsert({
                  where: { id: seasonPrice.id },
                  update: seasonPriceData,
                  create: seasonPriceData
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando seasonPrice ${seasonPrice.id}: ${error.message}`);
              }
            }
            break;

          case 'blockServiceSelections':
            for (const selection of data) {
              try {
                const { seasonBlock, serviceType, ...selectionData } = selection;
                await prisma.blockServiceSelection.upsert({
                  where: { id: selection.id },
                  update: selectionData,
                  create: selectionData
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando blockServiceSelection ${selection.id}: ${error.message}`);
              }
            }
            break;

          case 'dynamicPricingConfigs':
            for (const config of data) {
              try {
                await prisma.dynamicPricingConfig.upsert({
                  where: { id: config.id },
                  update: config,
                  create: config
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando dynamicPricingConfig ${config.id}: ${error.message}`);
              }
            }
            break;

          case 'roundingConfigs':
            for (const config of data) {
              try {
                /* rounding removed */
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando roundingConfig ${config.id}: ${error.message}`);
              }
            }
            break;

          case 'guests':
            for (const guest of data) {
              try {
                await prisma.guest.upsert({
                  where: { id: guest.id },
                  update: guest,
                  create: guest
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando guest ${guest.id}: ${error.message}`);
              }
            }
            break;

          case 'payments':
            for (const payment of data) {
              try {
                await prisma.payment.upsert({
                  where: { id: payment.id },
                  update: payment,
                  create: payment
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando payment ${payment.id}: ${error.message}`);
              }
            }
            break;

          case 'reservations':
            for (const reservation of data) {
              try {
                const { guests, room, mainClient, ...reservationData } = reservation;
                await prisma.reservation.upsert({
                  where: { id: reservation.id },
                  update: reservationData,
                  create: reservationData
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando reservation ${reservation.id}: ${error.message}`);
              }
            }
            break;
        }

        console.log(`✅ ${modelName}: ${restored} registros restaurados, ${errors} errores`);
        totalRestored += restored;

      } catch (error) {
        console.error(`❌ Error procesando ${modelName}:`, error.message);
      }
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
  restoreAllData();
}

module.exports = { restoreAllData };

