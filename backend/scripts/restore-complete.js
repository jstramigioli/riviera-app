const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreComplete() {
  try {
    console.log('🔄 Iniciando restauración completa de la base de datos...');
    
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
      'clients',
      'guests',
      'payments',
      'reservations',
      'openDays',
      'dynamicPricingConfigs',
      'dailyRoomRates',
      'roomGapPromotions',
      'reservationNightRates',
      'roundingConfigs',
      'seasonBlocks',
      'seasonPrices',
      'proportionCoefficients',
      'serviceTypes',
      'blockServiceSelections'
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
                await prisma.hotel.upsert({
                  where: { id: hotel.id },
                  update: hotel,
                  create: hotel
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
                await prisma.roomType.upsert({
                  where: { id: roomType.id },
                  update: roomType,
                  create: roomType
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
                const { tags, ...roomData } = room;
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

          case 'clients':
            for (const client of data) {
              try {
                const { reservations, ...clientData } = client;
                await prisma.client.upsert({
                  where: { id: client.id },
                  update: clientData,
                  create: clientData
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando client ${client.id}: ${error.message}`);
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

          case 'openDays':
            for (const openDay of data) {
              try {
                await prisma.openDay.upsert({
                  where: { id: openDay.id },
                  update: openDay,
                  create: openDay
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando openDay ${openDay.id}: ${error.message}`);
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

          case 'dailyRoomRates':
            for (const rate of data) {
              try {
                await prisma.dailyRoomRate.upsert({
                  where: { id: rate.id },
                  update: rate,
                  create: rate
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando dailyRoomRate ${rate.id}: ${error.message}`);
              }
            }
            break;

          case 'roomGapPromotions':
            for (const promotion of data) {
              try {
                await prisma.roomGapPromotion.upsert({
                  where: { id: promotion.id },
                  update: promotion,
                  create: promotion
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando roomGapPromotion ${promotion.id}: ${error.message}`);
              }
            }
            break;

          case 'reservationNightRates':
            for (const rate of data) {
              try {
                await prisma.reservationNightRate.upsert({
                  where: { id: rate.id },
                  update: rate,
                  create: rate
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando reservationNightRate ${rate.id}: ${error.message}`);
              }
            }
            break;

          case 'roundingConfigs':
            for (const config of data) {
              try {
                await prisma.roundingConfig.upsert({
                  where: { id: config.id },
                  update: config,
                  create: config
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando roundingConfig ${config.id}: ${error.message}`);
              }
            }
            break;

          case 'seasonBlocks':
            for (const block of data) {
              try {
                await prisma.seasonBlock.upsert({
                  where: { id: block.id },
                  update: block,
                  create: block
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando seasonBlock ${block.id}: ${error.message}`);
              }
            }
            break;

          case 'seasonPrices':
            for (const price of data) {
              try {
                await prisma.seasonPrice.upsert({
                  where: { id: price.id },
                  update: price,
                  create: price
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando seasonPrice ${price.id}: ${error.message}`);
              }
            }
            break;

          case 'proportionCoefficients':
            for (const coefficient of data) {
              try {
                await prisma.proportionCoefficient.upsert({
                  where: { id: coefficient.id },
                  update: coefficient,
                  create: coefficient
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando proportionCoefficient ${coefficient.id}: ${error.message}`);
              }
            }
            break;

          case 'serviceTypes':
            for (const serviceType of data) {
              try {
                await prisma.serviceType.upsert({
                  where: { id: serviceType.id },
                  update: serviceType,
                  create: serviceType
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando serviceType ${serviceType.id}: ${error.message}`);
              }
            }
            break;

          case 'blockServiceSelections':
            for (const selection of data) {
              try {
                await prisma.blockServiceSelection.upsert({
                  where: { id: selection.id },
                  update: selection,
                  create: selection
                });
                restored++;
              } catch (error) {
                errors++;
                console.log(`❌ Error restaurando blockServiceSelection ${selection.id}: ${error.message}`);
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
  restoreComplete();
}

module.exports = { restoreComplete };

