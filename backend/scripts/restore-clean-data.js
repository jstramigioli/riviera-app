const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreCleanData() {
  try {
    console.log('🔄 Restaurando datos limpios del backup...');
    
    // Usar el backup más reciente
    const backupPath = path.join(__dirname, '../backups/backup_2025-09-02T22-59-43-571Z');
    
    if (!fs.existsSync(backupPath)) {
      console.error('❌ No se encontró el directorio de backup');
      return;
    }

    // Leer metadatos del backup
    const metadataPath = path.join(backupPath, 'backup-metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log(`📊 Backup creado el: ${metadata.backupCreatedAt}`);
    console.log(`📈 Total de registros: ${metadata.totalRecords}`);

    // 1. Limpiar datos existentes (excepto el hotel que ya existe)
    console.log('🧹 Limpiando datos existentes...');
    await prisma.client.deleteMany();
    await prisma.room.deleteMany();
    await prisma.roomType.deleteMany();
    await prisma.serviceType.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.dynamicPricingConfig.deleteMany();
    await prisma.roundingConfig.deleteMany();
    console.log('✅ Datos limpiados');

    // 2. Restaurar tags (sin relaciones)
    console.log('🏷️ Restaurando tags...');
    const tagsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'tags.json'), 'utf8'));
    if (tagsData.length > 0) {
      const cleanTagsData = tagsData.map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color
      }));
      
      await prisma.tag.createMany({
        data: cleanTagsData,
        skipDuplicates: true
      });
      console.log(`✅ Tags restaurados: ${cleanTagsData.length}`);
    }

    // 3. Restaurar tipos de habitación (sin relaciones)
    console.log('🛏️ Restaurando tipos de habitación...');
    const roomTypesData = JSON.parse(fs.readFileSync(path.join(backupPath, 'roomTypes.json'), 'utf8'));
    if (roomTypesData.length > 0) {
      const cleanRoomTypesData = roomTypesData.map(roomType => ({
        id: roomType.id,
        name: roomType.name,
        description: roomType.description,
        maxPeople: roomType.maxPeople,
        orderIndex: roomType.orderIndex
      }));
      
      await prisma.roomType.createMany({
        data: cleanRoomTypesData,
        skipDuplicates: true
      });
      console.log(`✅ Tipos de habitación restaurados: ${cleanRoomTypesData.length}`);
    }

    // 4. Restaurar habitaciones (sin relaciones)
    console.log('🏠 Restaurando habitaciones...');
    const roomsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'rooms.json'), 'utf8'));
    if (roomsData.length > 0) {
      const cleanRoomsData = roomsData.map(room => ({
        id: room.id,
        name: room.name,
        description: room.description,
        maxPeople: room.maxPeople,
        status: room.status,
        orderIndex: room.orderIndex,
        roomTypeId: room.roomTypeId,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt
      }));
      
      await prisma.room.createMany({
        data: cleanRoomsData,
        skipDuplicates: true
      });
      console.log(`✅ Habitaciones restauradas: ${cleanRoomsData.length}`);
    }

    // 5. Restaurar tipos de servicio (sin relaciones)
    console.log('🍽️ Restaurando tipos de servicio...');
    const serviceTypesData = JSON.parse(fs.readFileSync(path.join(backupPath, 'serviceTypes.json'), 'utf8'));
    if (serviceTypesData.length > 0) {
      const cleanServiceTypesData = serviceTypesData.map(serviceType => ({
        id: serviceType.id,
        hotelId: serviceType.hotelId,
        name: serviceType.name,
        description: serviceType.description,
        isActive: serviceType.isActive,
        orderIndex: serviceType.orderIndex,
        createdAt: serviceType.createdAt,
        updatedAt: serviceType.updatedAt
      }));
      
      await prisma.serviceType.createMany({
        data: cleanServiceTypesData,
        skipDuplicates: true
      });
      console.log(`✅ Tipos de servicio restaurados: ${cleanServiceTypesData.length}`);
    }

    // 6. Restaurar clientes (sin relaciones)
    console.log('👥 Restaurando clientes...');
    const clientsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'clients.json'), 'utf8'));
    if (clientsData.length > 0) {
      const cleanClientsData = clientsData.map(client => ({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        country: client.country,
        province: client.province,
        city: client.city,
        documentType: client.documentType,
        documentNumber: client.documentNumber,
        notes: client.notes,
        wantsPromotions: client.wantsPromotions,
        esFicticio: client.esFicticio,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt
      }));
      
      // Insertar en lotes para evitar problemas de memoria
      const batchSize = 100;
      for (let i = 0; i < cleanClientsData.length; i += batchSize) {
        const batch = cleanClientsData.slice(i, i + batchSize);
        await prisma.client.createMany({
          data: batch,
          skipDuplicates: true
        });
        console.log(`📦 Lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(cleanClientsData.length/batchSize)} procesado`);
      }
      console.log(`✅ Clientes restaurados: ${cleanClientsData.length}`);
    }

    // 7. Restaurar configuración de precios dinámicos (sin relaciones)
    console.log('⚙️ Restaurando configuración de precios dinámicos...');
    const dynamicPricingData = JSON.parse(fs.readFileSync(path.join(backupPath, 'dynamicPricingConfigs.json'), 'utf8'));
    if (dynamicPricingData.length > 0) {
      const cleanDynamicPricingData = dynamicPricingData.map(config => ({
        id: config.id,
        hotelId: config.hotelId,
        enabled: config.enabled,
        anticipationThresholds: config.anticipationThresholds,
        anticipationWeight: config.anticipationWeight,
        globalOccupancyWeight: config.globalOccupancyWeight,
        isWeekendWeight: config.isWeekendWeight,
        weekendDays: config.weekendDays,
        isHolidayWeight: config.isHolidayWeight,
        weatherScoreWeight: config.weatherScoreWeight,
        eventImpactWeight: config.eventImpactWeight,
        maxAdjustmentPercentage: config.maxAdjustmentPercentage,
        enableGapPromos: config.enableGapPromos,
        enableWeatherApi: config.enableWeatherApi,
        enableRecentDemand: config.enableRecentDemand,
        anticipationMode: config.anticipationMode,
        anticipationMaxDays: config.anticipationMaxDays,
        standardRate: config.standardRate,
        idealOccupancy: config.idealOccupancy,
        occupancyAdjustmentPercentage: config.occupancyAdjustmentPercentage,
        anticipationAdjustmentPercentage: config.anticipationAdjustmentPercentage,
        weekendAdjustmentPercentage: config.weekendAdjustmentPercentage,
        holidayAdjustmentPercentage: config.holidayAdjustmentPercentage,
        occupancyEnabled: config.occupancyEnabled,
        anticipationEnabled: config.anticipationEnabled,
        weekendEnabled: config.weekendEnabled,
        holidayEnabled: config.holidayEnabled,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      }));
      
      await prisma.dynamicPricingConfig.createMany({
        data: cleanDynamicPricingData,
        skipDuplicates: true
      });
      console.log(`✅ Configuración de precios dinámicos restaurada: ${cleanDynamicPricingData.length}`);
    }

    // 8. Restaurar configuración de redondeo (sin relaciones)
    console.log('🔢 Restaurando configuración de redondeo...');
    const roundingData = JSON.parse(fs.readFileSync(path.join(backupPath, 'roundingConfigs.json'), 'utf8'));
    if (roundingData.length > 0) {
      const cleanRoundingData = roundingData.map(config => ({
        id: config.id,
        hotelId: config.hotelId,
        multiple: config.multiple,
        mode: config.mode,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      }));
      
      await prisma.roundingConfig.createMany({
        data: cleanRoundingData,
        skipDuplicates: true
      });
      console.log(`✅ Configuración de redondeo restaurada: ${cleanRoundingData.length}`);
    }

    // 9. Restaurar bloques de temporada (sin relaciones)
    console.log('📅 Restaurando bloques de temporada...');
    const seasonBlocksData = JSON.parse(fs.readFileSync(path.join(backupPath, 'seasonBlocks.json'), 'utf8'));
    if (seasonBlocksData.length > 0) {
      const cleanSeasonBlocksData = seasonBlocksData.map(block => ({
        id: block.id,
        hotelId: block.hotelId,
        name: block.name,
        description: block.description,
        startDate: block.startDate,
        endDate: block.endDate,
        isActive: block.isActive,
        orderIndex: block.orderIndex,
        useBlockServices: block.useBlockServices,
        basePrice: block.basePrice,
        useProportions: block.useProportions,
        referenceRoomTypeId: block.referenceRoomTypeId,
        serviceAdjustmentMode: block.serviceAdjustmentMode,
        isDraft: block.isDraft,
        lastSavedAt: block.lastSavedAt,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt
      }));
      
      await prisma.seasonBlock.createMany({
        data: cleanSeasonBlocksData,
        skipDuplicates: true
      });
      console.log(`✅ Bloques de temporada restaurados: ${cleanSeasonBlocksData.length}`);
    }

    // 10. Restaurar precios de temporada (sin relaciones)
    console.log('💰 Restaurando precios de temporada...');
    const seasonPricesData = JSON.parse(fs.readFileSync(path.join(backupPath, 'seasonPrices.json'), 'utf8'));
    if (seasonPricesData.length > 0) {
      const cleanSeasonPricesData = seasonPricesData.map(price => ({
        id: price.id,
        seasonBlockId: price.seasonBlockId,
        roomTypeId: price.roomTypeId,
        serviceTypeId: price.serviceTypeId,
        basePrice: price.basePrice,
        isDraft: price.isDraft,
        createdAt: price.createdAt,
        updatedAt: price.updatedAt
      }));
      
      await prisma.seasonPrice.createMany({
        data: cleanSeasonPricesData,
        skipDuplicates: true
      });
      console.log(`✅ Precios de temporada restaurados: ${cleanSeasonPricesData.length}`);
    }

    // 11. Restaurar selecciones de servicio de bloque (sin relaciones)
    console.log('🍽️ Restaurando servicios de bloque...');
    const blockServiceSelectionsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'blockServiceSelections.json'), 'utf8'));
    if (blockServiceSelectionsData.length > 0) {
      const cleanBlockServiceSelectionsData = blockServiceSelectionsData.map(selection => ({
        id: selection.id,
        seasonBlockId: selection.seasonBlockId,
        serviceTypeId: selection.serviceTypeId,
        isEnabled: selection.isEnabled,
        orderIndex: selection.orderIndex,
        isDraft: selection.isDraft,
        percentageAdjustment: selection.percentageAdjustment,
        createdAt: selection.createdAt,
        updatedAt: selection.updatedAt
      }));
      
      await prisma.blockServiceSelection.createMany({
        data: cleanBlockServiceSelectionsData,
        skipDuplicates: true
      });
      console.log(`✅ Servicios de bloque restaurados: ${cleanBlockServiceSelectionsData.length}`);
    }

    console.log('🎉 Restauración de datos reales completada!');
    
    // Verificar datos restaurados
    const finalCounts = await Promise.all([
      prisma.hotel.count(),
      prisma.client.count(),
      prisma.room.count(),
      prisma.roomType.count(),
      prisma.serviceType.count(),
      prisma.tag.count(),
      prisma.dynamicPricingConfig.count(),
      prisma.roundingConfig.count(),
      prisma.seasonBlock.count(),
      prisma.seasonPrice.count(),
      prisma.blockServiceSelection.count()
    ]);
    
    console.log('📊 Datos restaurados:');
    console.log(`🏨 Hoteles: ${finalCounts[0]}`);
    console.log(`👥 Clientes: ${finalCounts[1]}`);
    console.log(`🏠 Habitaciones: ${finalCounts[2]}`);
    console.log(`🛏️ Tipos de habitación: ${finalCounts[3]}`);
    console.log(`🍽️ Tipos de servicio: ${finalCounts[4]}`);
    console.log(`🏷️ Tags: ${finalCounts[5]}`);
    console.log(`⚙️ Configuración de precios: ${finalCounts[6]}`);
    console.log(`🔢 Configuración de redondeo: ${finalCounts[7]}`);
    console.log(`📅 Bloques de temporada: ${finalCounts[8]}`);
    console.log(`💰 Precios de temporada: ${finalCounts[9]}`);
    console.log(`🍽️ Servicios de bloque: ${finalCounts[10]}`);

  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreCleanData();
