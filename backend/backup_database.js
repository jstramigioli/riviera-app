const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups', timestamp);
  
  // Crear directorio de backup
  if (!fs.existsSync(path.join(__dirname, 'backups'))) {
    fs.mkdirSync(path.join(__dirname, 'backups'));
  }
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`🗄️ Creando backup en: ${backupDir}`);

  try {
    // 1. Backup de CLIENTES (muy importante)
    console.log('👥 Respaldando clientes...');
    const clients = await prisma.client.findMany({
      include: {
        queries: true,
        reservations: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'clients.json'),
      JSON.stringify(clients, null, 2)
    );
    console.log(`✅ Clientes respaldados: ${clients.length} registros`);

    // 2. Backup de HABITACIONES con etiquetas (muy importante)
    console.log('🏨 Respaldando habitaciones con etiquetas...');
    const rooms = await prisma.room.findMany({
      include: {
        tags: true,
        roomType: true,
        segments: true,
        queries: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'rooms.json'),
      JSON.stringify(rooms, null, 2)
    );
    console.log(`✅ Habitaciones respaldadas: ${rooms.length} registros`);

    // 3. Backup de TIPOS DE HABITACIÓN
    console.log('🏠 Respaldando tipos de habitación...');
    const roomTypes = await prisma.roomType.findMany({
      include: {
        rooms: true,
        proportionCoefficients: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'roomTypes.json'),
      JSON.stringify(roomTypes, null, 2)
    );
    console.log(`✅ Tipos de habitación respaldados: ${roomTypes.length} registros`);

    // 4. Backup de ETIQUETAS
    console.log('🏷️ Respaldando etiquetas...');
    const tags = await prisma.tag.findMany({
      include: {
        rooms: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'tags.json'),
      JSON.stringify(tags, null, 2)
    );
    console.log(`✅ Etiquetas respaldadas: ${tags.length} registros`);

    // 5. Backup de BLOQUES DE RESERVA (muy importante)
    console.log('📅 Respaldando bloques de reserva...');
    const seasonBlocks = await prisma.seasonBlock.findMany({
      include: {
        prices: true,
        serviceTypes: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'seasonBlocks.json'),
      JSON.stringify(seasonBlocks, null, 2)
    );
    console.log(`✅ Bloques de reserva respaldados: ${seasonBlocks.length} registros`);

    // 6. Backup de RESERVAS
    console.log('📋 Respaldando reservas...');
    const reservations = await prisma.reservation.findMany({
      include: {
        segments: true,
        guests: true,
        mainClient: true,
        room: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'reservations.json'),
      JSON.stringify(reservations, null, 2)
    );
    console.log(`✅ Reservas respaldadas: ${reservations.length} registros`);

    // 7. Backup de CONSULTAS
    console.log('❓ Respaldando consultas...');
    const queries = await prisma.query.findMany({
      include: {
        guests: true,
        mainClient: true,
        room: true,
        nightRates: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'queries.json'),
      JSON.stringify(queries, null, 2)
    );
    console.log(`✅ Consultas respaldadas: ${queries.length} registros`);

    // 8. Backup de HOTEL
    console.log('🏢 Respaldando configuración del hotel...');
    const hotel = await prisma.hotel.findMany({
      include: {
        dynamicPricingConfig: true,
        roundingConfig: true,
        openDays: true,
        serviceTypes: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'hotel.json'),
      JSON.stringify(hotel, null, 2)
    );
    console.log(`✅ Hotel respaldado: ${hotel.length} registros`);

    // 9. Backup de CONFIGURACIÓN DE PRECIOS DINÁMICOS
    console.log('💰 Respaldando configuración de precios...');
    const dynamicPricing = await prisma.dynamicPricingConfig.findMany({
      include: {
        hotel: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'dynamicPricing.json'),
      JSON.stringify(dynamicPricing, null, 2)
    );
    console.log(`✅ Configuración de precios respaldada: ${dynamicPricing.length} registros`);

    // 10. Backup de DÍAS ABIERTOS
    console.log('📆 Respaldando días abiertos...');
    const openDays = await prisma.openDay.findMany();
    
    fs.writeFileSync(
      path.join(backupDir, 'openDays.json'),
      JSON.stringify(openDays, null, 2)
    );
    console.log(`✅ Días abiertos respaldados: ${openDays.length} registros`);

    // Crear archivo de resumen
    const summary = {
      timestamp: new Date().toISOString(),
      backupDir: backupDir,
      counts: {
        clients: clients.length,
        rooms: rooms.length,
        roomTypes: roomTypes.length,
        tags: tags.length,
        seasonBlocks: seasonBlocks.length,
        reservations: reservations.length,
        queries: queries.length,
        hotel: hotel.length,
        dynamicPricing: dynamicPricing.length,
        openDays: openDays.length
      }
    };

    fs.writeFileSync(
      path.join(backupDir, 'backup_summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n🎉 BACKUP COMPLETADO EXITOSAMENTE');
    console.log(`📁 Ubicación: ${backupDir}`);
    console.log('📊 Resumen:');
    console.log(`   👥 Clientes: ${clients.length}`);
    console.log(`   🏨 Habitaciones: ${rooms.length}`);
    console.log(`   🏠 Tipos de habitación: ${roomTypes.length}`);
    console.log(`   🏷️ Etiquetas: ${tags.length}`);
    console.log(`   📅 Bloques de reserva: ${seasonBlocks.length}`);
    console.log(`   📋 Reservas: ${reservations.length}`);
    console.log(`   ❓ Consultas: ${queries.length}`);
    console.log(`   🏢 Hotel: ${hotel.length}`);
    console.log(`   💰 Configuración de precios: ${dynamicPricing.length}`);
    console.log(`   📆 Días abiertos: ${openDays.length}`);

  } catch (error) {
    console.error('❌ Error durante el backup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createBackup()
  .then(() => {
    console.log('\n✅ Backup completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en el backup:', error);
    process.exit(1);
  });
