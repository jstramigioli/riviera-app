const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    console.log('🔄 Iniciando backup completo de la base de datos...');
    
    // Crear directorio para el backup
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup_${timestamp}`);
    fs.mkdirSync(backupPath, { recursive: true });

    console.log(`📁 Backup se guardará en: ${backupPath}`);

    // Exportar cada modelo con todas sus relaciones
    const models = [
      { 
        name: 'hotels', 
        query: prisma.hotel.findMany({
          include: {
            dailyRoomRates: true,
            dynamicPricingConfig: true,
            openDays: true,
            roundingConfig: true,
            seasonBlocks: {
              include: {
                blockServiceSelections: true,
                proportionCoefficients: true,
                seasonPrices: true
              }
            },
            serviceTypes: true
          }
        })
      },
      { 
        name: 'tags', 
        query: prisma.tag.findMany({
          include: {
            rooms: true
          }
        })
      },
      { 
        name: 'roomTypes', 
        query: prisma.roomType.findMany({
          include: {
            dailyRoomRates: true,
            proportionCoefficients: true,
            rooms: true,
            seasonPrices: true
          }
        })
      },
      { 
        name: 'rooms', 
        query: prisma.room.findMany({ 
          include: { 
            tags: true,
            reservations: {
              include: {
                guests: true,
                nightRates: true,
                mainClient: true
              }
            },
            gapPromotions: true,
            roomType: true
          } 
        })
      },
      { 
        name: 'clients', 
        query: prisma.client.findMany({
          include: {
            reservations: {
              include: {
                guests: true,
                nightRates: true,
                room: true
              }
            }
          }
        })
      },
      { 
        name: 'guests', 
        query: prisma.guest.findMany({
          include: {
            reservation: true,
            payments: true
          }
        })
      },
      { 
        name: 'payments', 
        query: prisma.payment.findMany({
          include: {
            guest: true
          }
        })
      },
      { 
        name: 'reservations', 
        query: prisma.reservation.findMany({ 
          include: { 
            guests: {
              include: {
                payments: true
              }
            },
            room: { 
              include: { 
                tags: true,
                roomType: true
              } 
            },
            mainClient: true,
            nightRates: true
          } 
        })
      },
      { 
        name: 'openDays', 
        query: prisma.openDay.findMany({
          include: {
            hotel: true
          }
        })
      },
      { 
        name: 'dynamicPricingConfigs', 
        query: prisma.dynamicPricingConfig.findMany({
          include: {
            hotel: true
          }
        })
      },
      { 
        name: 'dailyRoomRates', 
        query: prisma.dailyRoomRate.findMany({
          include: {
            hotel: true,
            roomType: true
          }
        })
      },
      { 
        name: 'roomGapPromotions', 
        query: prisma.roomGapPromotion.findMany({
          include: {
            room: true
          }
        })
      },
      { 
        name: 'reservationNightRates', 
        query: prisma.reservationNightRate.findMany({
          include: {
            reservation: true
          }
        })
      },
      { 
        name: 'roundingConfigs', 
        query: prisma.roundingConfig.findMany({
          include: {
            hotel: true
          }
        })
      },
      { 
        name: 'seasonBlocks', 
        query: prisma.seasonBlock.findMany({
          include: {
            hotel: true,
            blockServiceSelections: {
              include: {
                serviceType: true
              }
            },
            proportionCoefficients: {
              include: {
                roomType: true
              }
            },
            seasonPrices: {
              include: {
                roomType: true,
                serviceType: true
              }
            }
          }
        })
      },
      { 
        name: 'seasonPrices', 
        query: prisma.seasonPrice.findMany({
          include: {
            roomType: true,
            seasonBlock: true,
            serviceType: true
          }
        })
      },
      { 
        name: 'proportionCoefficients', 
        query: prisma.proportionCoefficient.findMany({
          include: {
            roomType: true,
            seasonBlock: true
          }
        })
      },
      { 
        name: 'serviceTypes', 
        query: prisma.serviceType.findMany({
          include: {
            hotel: true,
            blockServiceSelections: true,
            seasonPrices: true
          }
        })
      },
      { 
        name: 'blockServiceSelections', 
        query: prisma.blockServiceSelection.findMany({
          include: {
            seasonBlock: true,
            serviceType: true
          }
        })
      }
    ];

    const modelStats = [];

    for (const model of models) {
      console.log(`📦 Exportando ${model.name}...`);
      const data = await model.query;
      
      const filePath = path.join(backupPath, `${model.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      console.log(`✅ ${model.name}: ${data.length} registros exportados`);
      modelStats.push({ name: model.name, count: data.length });
    }

    // Crear archivo de metadatos del backup
    const metadata = {
      backupCreatedAt: new Date().toISOString(),
      totalRecords: modelStats.reduce((acc, stat) => acc + stat.count, 0),
      models: modelStats,
      schemaVersion: 'latest',
      backupType: 'full'
    };

    fs.writeFileSync(
      path.join(backupPath, 'backup-metadata.json'), 
      JSON.stringify(metadata, null, 2)
    );

    // Crear archivo de resumen
    const summary = {
      timestamp: new Date().toISOString(),
      backupPath: backupPath,
      totalModels: modelStats.length,
      totalRecords: metadata.totalRecords,
      status: 'completed'
    };

    fs.writeFileSync(
      path.join(backupDir, 'latest-backup-summary.json'), 
      JSON.stringify(summary, null, 2)
    );

    console.log('🎉 Backup completado exitosamente!');
    console.log(`📁 Backup guardado en: ${backupPath}`);
    console.log(`📊 Total de registros: ${metadata.totalRecords}`);
    console.log(`📋 Total de modelos: ${modelStats.length}`);

    return backupPath;

  } catch (error) {
    console.error('❌ Error durante el backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  backupDatabase()
    .then(() => {
      console.log('✅ Backup finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en el backup:', error);
      process.exit(1);
    });
}

module.exports = { backupDatabase }; 