const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function simpleRestore() {
  try {
    console.log('🔄 Restauración simple desde backup...');
    
    // Usar el backup más reciente
    const backupPath = path.join(__dirname, '../backups/backup_2025-09-02T22-59-43-571Z');
    
    if (!fs.existsSync(backupPath)) {
      console.error('❌ No se encontró el directorio de backup');
      return;
    }

    // 1. Restaurar hotel
    console.log('🏨 Restaurando hotel...');
    const hotelsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'hotels.json'), 'utf8'));
    if (hotelsData.length > 0) {
      await prisma.hotel.createMany({
        data: hotelsData,
        skipDuplicates: true
      });
      console.log(`✅ Hotel restaurado: ${hotelsData.length} registros`);
    }

    // 2. Restaurar tipos de habitación
    console.log('🛏️ Restaurando tipos de habitación...');
    const roomTypesData = JSON.parse(fs.readFileSync(path.join(backupPath, 'roomTypes.json'), 'utf8'));
    if (roomTypesData.length > 0) {
      await prisma.roomType.createMany({
        data: roomTypesData,
        skipDuplicates: true
      });
      console.log(`✅ Tipos de habitación restaurados: ${roomTypesData.length} registros`);
    }

    // 3. Restaurar habitaciones
    console.log('🏠 Restaurando habitaciones...');
    const roomsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'rooms.json'), 'utf8'));
    if (roomsData.length > 0) {
      // Limpiar relaciones que pueden causar problemas
      const cleanRoomsData = roomsData.map(room => ({
        id: room.id,
        name: room.name,
        description: room.description,
        maxPeople: room.maxPeople,
        roomTypeId: room.roomTypeId,
        hotelId: room.hotelId,
        isActive: room.isActive,
        orderIndex: room.orderIndex,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt
      }));
      
      await prisma.room.createMany({
        data: cleanRoomsData,
        skipDuplicates: true
      });
      console.log(`✅ Habitaciones restauradas: ${cleanRoomsData.length} registros`);
    }

    // 4. Restaurar clientes
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
        address: client.address,
        city: client.city,
        documentType: client.documentType,
        documentNumber: client.documentNumber,
        isFicticio: client.isFicticio,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt
      }));
      
      await prisma.client.createMany({
        data: cleanClientsData,
        skipDuplicates: true
      });
      console.log(`✅ Clientes restaurados: ${cleanClientsData.length} registros`);
    }

    // 5. Restaurar tipos de servicio
    console.log('🍽️ Restaurando tipos de servicio...');
    const serviceTypesData = JSON.parse(fs.readFileSync(path.join(backupPath, 'serviceTypes.json'), 'utf8'));
    if (serviceTypesData.length > 0) {
      await prisma.serviceType.createMany({
        data: serviceTypesData,
        skipDuplicates: true
      });
      console.log(`✅ Tipos de servicio restaurados: ${serviceTypesData.length} registros`);
    }

    // 6. Restaurar tags
    console.log('🏷️ Restaurando tags...');
    const tagsData = JSON.parse(fs.readFileSync(path.join(backupPath, 'tags.json'), 'utf8'));
    if (tagsData.length > 0) {
      await prisma.tag.createMany({
        data: tagsData,
        skipDuplicates: true
      });
      console.log(`✅ Tags restaurados: ${tagsData.length} registros`);
    }

    console.log('🎉 Restauración simple completada!');
    
    // Verificar datos restaurados
    const finalCounts = await Promise.all([
      prisma.hotel.count(),
      prisma.client.count(),
      prisma.room.count(),
      prisma.roomType.count(),
      prisma.serviceType.count(),
      prisma.tag.count()
    ]);
    
    console.log('📊 Datos restaurados:');
    console.log(`🏨 Hoteles: ${finalCounts[0]}`);
    console.log(`👥 Clientes: ${finalCounts[1]}`);
    console.log(`🏠 Habitaciones: ${finalCounts[2]}`);
    console.log(`🛏️ Tipos de habitación: ${finalCounts[3]}`);
    console.log(`🍽️ Tipos de servicio: ${finalCounts[4]}`);
    console.log(`🏷️ Tags: ${finalCounts[5]}`);

  } catch (error) {
    console.error('❌ Error durante la restauración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simpleRestore();

