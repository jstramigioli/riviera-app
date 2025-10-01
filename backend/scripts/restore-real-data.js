const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreRealData() {
  try {
    console.log('🔄 Restaurando datos reales del backup...');
    
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

    // 2. Restaurar tags
    console.log('🏷️ Restaurando tags...');
    const tagsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'tags.json'), 'utf8'));
    if (tagsData.length > 0) {
      await prisma.tag.createMany({
        data: tagsData,
        skipDuplicates: true
      });
      console.log(`✅ Tags restaurados: ${tagsData.length}`);
    }

    // 3. Restaurar tipos de habitación
    console.log('🛏️ Restaurando tipos de habitación...');
    const roomTypesData = JSON.parse(fs.readFileSync(path.join(backupPath, 'roomTypes.json'), 'utf8'));
    if (roomTypesData.length > 0) {
      await prisma.roomType.createMany({
        data: roomTypesData,
        skipDuplicates: true
      });
      console.log(`✅ Tipos de habitación restaurados: ${roomTypesData.length}`);
    }

    // 4. Restaurar habitaciones
    console.log('🏠 Restaurando habitaciones...');
    const roomsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'rooms.json'), 'utf8'));
    if (roomsData.length > 0) {
      // Limpiar relaciones que pueden causar problemas
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

    // 5. Restaurar tipos de servicio
    console.log('🍽️ Restaurando tipos de servicio...');
    const serviceTypesData = JSON.parse(fs.readFileSync(path.join(backupPath, 'serviceTypes.json'), 'utf8'));
    if (serviceTypesData.length > 0) {
      await prisma.serviceType.createMany({
        data: serviceTypesData,
        skipDuplicates: true
      });
      console.log(`✅ Tipos de servicio restaurados: ${serviceTypesData.length}`);
    }

    // 6. Restaurar clientes
    console.log('👥 Restaurando clientes...');
    const clientsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'clients.json'), 'utf8'));
    if (clientsData.length > 0) {
      // Limpiar relaciones que pueden causar problemas
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

    // 7. Restaurar configuración de precios dinámicos
    console.log('⚙️ Restaurando configuración de precios dinámicos...');
    const dynamicPricingData = JSON.parse(fs.readFileSync(path.join(backupPath, 'dynamicPricingConfigs.json'), 'utf8'));
    if (dynamicPricingData.length > 0) {
      await prisma.dynamicPricingConfig.createMany({
        data: dynamicPricingData,
        skipDuplicates: true
      });
      console.log(`✅ Configuración de precios dinámicos restaurada: ${dynamicPricingData.length}`);
    }

    // 8. Restaurar configuración de redondeo
    console.log('🔢 Restaurando configuración de redondeo...');
    const roundingData = JSON.parse(fs.readFileSync(path.join(backupPath, 'roundingConfigs.json'), 'utf8'));
    if (roundingData.length > 0) {
      await prisma.roundingConfig.createMany({
        data: roundingData,
        skipDuplicates: true
      });
      console.log(`✅ Configuración de redondeo restaurada: ${roundingData.length}`);
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
      prisma.roundingConfig.count()
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

  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreRealData();

