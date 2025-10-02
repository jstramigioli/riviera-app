const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreFromBackup() {
  try {
    console.log('🔄 Restaurando base de datos desde backup...');
    
    // Ruta del backup más reciente
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

    for (const modelName of importOrder) {
      const filePath = path.join(backupPath, `${modelName}.json`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  No se encontró ${modelName}.json, saltando...`);
        continue;
      }

      console.log(`📦 Restaurando ${modelName}...`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (data.length === 0) {
        console.log(`ℹ️  ${modelName}: No hay datos para restaurar`);
        continue;
      }

      // Restaurar según el modelo
      switch (modelName) {
        case 'hotels':
          for (const hotel of data) {
            await prisma.hotel.upsert({
              where: { id: hotel.id },
              update: hotel,
              create: hotel
            });
          }
          break;

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
            const { reservations, ...clientData } = client;
            await prisma.client.upsert({
              where: { id: client.id },
              update: clientData,
              create: clientData
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

        case 'openDays':
          for (const openDay of data) {
            await prisma.openDay.upsert({
              where: { id: openDay.id },
              update: openDay,
              create: openDay
            });
          }
          break;

        case 'dynamicPricingConfigs':
          for (const config of data) {
            await prisma.dynamicPricingConfig.upsert({
              where: { id: config.id },
              update: config,
              create: config
            });
          }
          break;

        case 'dailyRoomRates':
          for (const rate of data) {
            await prisma.dailyRoomRate.upsert({
              where: { id: rate.id },
              update: rate,
              create: rate
            });
          }
          break;

        case 'roomGapPromotions':
          for (const promotion of data) {
            await prisma.roomGapPromotion.upsert({
              where: { id: promotion.id },
              update: promotion,
              create: promotion
            });
          }
          break;

        case 'reservationNightRates':
          for (const rate of data) {
            await prisma.reservationNightRate.upsert({
              where: { id: rate.id },
              update: rate,
              create: rate
            });
          }
          break;

        case 'roundingConfigs':
          for (const config of data) {
            await prisma.roundingConfig.upsert({
              where: { id: config.id },
              update: config,
              create: config
            });
          }
          break;

        case 'seasonBlocks':
          for (const block of data) {
            await prisma.seasonBlock.upsert({
              where: { id: block.id },
              update: block,
              create: block
            });
          }
          break;

        case 'seasonPrices':
          for (const price of data) {
            await prisma.seasonPrice.upsert({
              where: { id: price.id },
              update: price,
              create: price
            });
          }
          break;

        case 'proportionCoefficients':
          for (const coefficient of data) {
            await prisma.proportionCoefficient.upsert({
              where: { id: coefficient.id },
              update: coefficient,
              create: coefficient
            });
          }
          break;

        case 'serviceTypes':
          for (const serviceType of data) {
            await prisma.serviceType.upsert({
              where: { id: serviceType.id },
              update: serviceType,
              create: serviceType
            });
          }
          break;

        case 'blockServiceSelections':
          for (const selection of data) {
            await prisma.blockServiceSelection.upsert({
              where: { id: selection.id },
              update: selection,
              create: selection
            });
          }
          break;
      }

      console.log(`✅ ${modelName}: ${data.length} registros restaurados`);
    }

    console.log('🎉 Restauración completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  restoreFromBackup();
}

module.exports = { restoreFromBackup };