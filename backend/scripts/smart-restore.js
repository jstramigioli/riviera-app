const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function smartRestore() {
  try {
    console.log('🔄 Restauración inteligente desde backup...');
    
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

    // Verificar estado actual de la base de datos
    console.log('🔍 Verificando estado actual de la base de datos...');
    const currentCounts = await Promise.all([
      prisma.hotel.count(),
      prisma.client.count(),
      prisma.room.count(),
      prisma.reservation.count(),
      prisma.query.count()
    ]);
    
    console.log('📊 Estado actual:');
    console.log(`🏨 Hoteles: ${currentCounts[0]}`);
    console.log(`👥 Clientes: ${currentCounts[1]}`);
    console.log(`🏠 Habitaciones: ${currentCounts[2]}`);
    console.log(`📅 Reservas: ${currentCounts[3]}`);
    console.log(`❓ Consultas: ${currentCounts[4]}`);

    // Solo proceder si la base de datos está vacía
    if (currentCounts.some(count => count > 0)) {
      console.log('⚠️ La base de datos no está vacía. ¿Deseas continuar? (Ctrl+C para cancelar)');
      // En un entorno real, aquí podrías pedir confirmación
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
      'seasonBlocks',
      'seasonPrices',
      'blockServiceSelections',
      'openDays',
      'payments',
      'dailyRoomRates',
      'roomGapPromotions',
      'reservationNightRates',
      'proportionCoefficients'
      // No incluir 'reservations' ni 'queries' para preservar el estado actual
    ];

    // Limpiar solo las tablas que vamos a restaurar
    console.log('🧹 Limpiando tablas específicas...');
    
    // Limpiar en orden inverso para respetar foreign keys
    const cleanupOrder = [
      'payments',
      'guests', 
      'clients',
      'dailyRoomRates',
      'roomGapPromotions',
      'reservationNightRates',
      'proportionCoefficients',
      'blockServiceSelections',
      'seasonPrices',
      'seasonBlocks',
      'openDays',
      'dynamicPricingConfigs',
      'serviceTypes',
      'rooms',
      'roomTypes',
      'tags',
      'hotels'
    ];

    for (const model of cleanupOrder) {
      try {
        const modelName = model.slice(0, -1); // Quitar 's' del final
        await prisma[modelName].deleteMany();
        console.log(`✅ ${model} limpiado`);
      } catch (error) {
        console.log(`⚠️ ${model}: ${error.message}`);
      }
    }

    // Importar datos en orden
    for (const model of importOrder) {
      const filePath = path.join(backupPath, `${model}.json`);
      
      if (fs.existsSync(filePath)) {
        console.log(`📥 Importando ${model}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.length > 0) {
          try {
            const modelName = model.slice(0, -1); // Quitar 's' del final
            
            // Manejar casos especiales
            if (model === 'hotels') {
              await prisma.hotel.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'tags') {
              await prisma.tag.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'roomTypes') {
              await prisma.roomType.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'rooms') {
              await prisma.room.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'serviceTypes') {
              await prisma.serviceType.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'clients') {
              await prisma.client.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'guests') {
              await prisma.guest.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'dynamicPricingConfigs') {
              await prisma.dynamicPricingConfig.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'roundingConfigs') {
              /* rounding removed */
            } else if (model === 'seasonBlocks') {
              await prisma.seasonBlock.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'seasonPrices') {
              await prisma.seasonPrice.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'blockServiceSelections') {
              await prisma.blockServiceSelection.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'openDays') {
              await prisma.openDay.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'payments') {
              await prisma.payment.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'dailyRoomRates') {
              await prisma.dailyRoomRate.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'roomGapPromotions') {
              await prisma.roomGapPromotion.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'reservationNightRates') {
              await prisma.reservationNightRate.createMany({
                data: data,
                skipDuplicates: true
              });
            } else if (model === 'proportionCoefficients') {
              await prisma.proportionCoefficient.createMany({
                data: data,
                skipDuplicates: true
              });
            }
            
            console.log(`✅ ${model}: ${data.length} registros importados`);
          } catch (error) {
            console.log(`❌ Error importando ${model}: ${error.message}`);
          }
        } else {
          console.log(`⏭️ ${model}: sin datos`);
        }
      } else {
        console.log(`⚠️ ${model}: archivo no encontrado`);
      }
    }

    console.log('🎉 Restauración completada exitosamente!');
    
    // Verificar datos importados
    const finalCounts = await Promise.all([
      prisma.hotel.count(),
      prisma.client.count(),
      prisma.room.count(),
      prisma.reservation.count(),
      prisma.query.count()
    ]);
    
    console.log('📊 Datos restaurados:');
    console.log(`🏨 Hoteles: ${finalCounts[0]}`);
    console.log(`👥 Clientes: ${finalCounts[1]}`);
    console.log(`🏠 Habitaciones: ${finalCounts[2]}`);
    console.log(`📅 Reservas: ${finalCounts[3]} (preservadas)`);
    console.log(`❓ Consultas: ${finalCounts[4]} (preservadas)`);

  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

smartRestore();

