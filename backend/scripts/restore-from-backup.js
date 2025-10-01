const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreFromBackup() {
  try {
    console.log('🔄 Restaurando base de datos desde backup...');
    
    // Usar el backup más reciente
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
      'clients',
      'guests',
      'dynamicPricingConfigs',
      'roundingConfigs',
      'seasonBlocks',
      'seasonPrices',
      'blockServiceSelections',
      'openDays',
      'payments',
      'dailyRoomRates',
      'roomGapPromotions',
      'reservationNightRates',
      'proportionCoefficients',
      'reservations'
    ];

    // Limpiar base de datos actual
    console.log('🧹 Limpiando base de datos actual...');
    await prisma.reservation.deleteMany();
    await prisma.query.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.guest.deleteMany();
    await prisma.client.deleteMany();
    await prisma.dailyRoomRate.deleteMany();
    await prisma.roomGapPromotion.deleteMany();
    await prisma.reservationNightRate.deleteMany();
    await prisma.proportionCoefficient.deleteMany();
    await prisma.blockServiceSelection.deleteMany();
    await prisma.seasonPrice.deleteMany();
    await prisma.seasonBlock.deleteMany();
    await prisma.openDay.deleteMany();
    await prisma.dynamicPricingConfig.deleteMany();
    await prisma.roundingConfig.deleteMany();
    await prisma.serviceType.deleteMany();
    await prisma.room.deleteMany();
    await prisma.roomType.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.hotel.deleteMany();

    console.log('✅ Base de datos limpiada');

    // Importar datos en orden
    for (const model of importOrder) {
      const filePath = path.join(backupPath, `${model}.json`);
      
      if (fs.existsSync(filePath)) {
        console.log(`📥 Importando ${model}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.length > 0) {
          // Usar createMany para modelos simples
          if (['hotels', 'tags', 'roomTypes', 'rooms', 'serviceTypes', 'clients', 'guests', 'dynamicPricingConfigs', 'roundingConfigs', 'seasonBlocks', 'seasonPrices', 'blockServiceSelections', 'openDays', 'payments'].includes(model)) {
            await prisma[model.slice(0, -1)].createMany({
              data: data,
              skipDuplicates: true
            });
          }
          
          console.log(`✅ ${model}: ${data.length} registros importados`);
        } else {
          console.log(`⏭️ ${model}: sin datos`);
        }
      } else {
        console.log(`⚠️ ${model}: archivo no encontrado`);
      }
    }

    console.log('🎉 Restauración completada exitosamente!');
    
    // Verificar datos importados
    const counts = await Promise.all([
      prisma.hotel.count(),
      prisma.client.count(),
      prisma.room.count(),
      prisma.reservation.count(),
      prisma.query.count()
    ]);
    
    console.log('📊 Datos restaurados:');
    console.log(`🏨 Hoteles: ${counts[0]}`);
    console.log(`👥 Clientes: ${counts[1]}`);
    console.log(`🏠 Habitaciones: ${counts[2]}`);
    console.log(`📅 Reservas: ${counts[3]}`);
    console.log(`❓ Consultas: ${counts[4]}`);

  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreFromBackup();

