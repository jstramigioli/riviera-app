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
        segments: true
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
        seasonPrices: true,
        blockServiceSelections: true,
        proportionCoefficients: true,
        hotel: true
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
        nightRates: true,
        childReservations: true,
        parentReservation: true
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

    // 11. Backup de HUÉSPEDES
    console.log('👤 Respaldando huéspedes...');
    const guests = await prisma.guest.findMany({
      include: {
        payments: true,
        reservation: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'guests.json'),
      JSON.stringify(guests, null, 2)
    );
    console.log(`✅ Huéspedes respaldados: ${guests.length} registros`);

    // 12. Backup de PAGOS
    console.log('💳 Respaldando pagos...');
    const payments = await prisma.payment.findMany({
      include: {
        guest: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'payments.json'),
      JSON.stringify(payments, null, 2)
    );
    console.log(`✅ Pagos respaldados: ${payments.length} registros`);

    // 13. Backup de HUÉSPEDES DE CONSULTA
    console.log('👥 Respaldando huéspedes de consultas...');
    const queryGuests = await prisma.queryGuest.findMany({
      include: {
        payments: true,
        query: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'queryGuests.json'),
      JSON.stringify(queryGuests, null, 2)
    );
    console.log(`✅ Huéspedes de consultas respaldados: ${queryGuests.length} registros`);

    // 14. Backup de PAGOS DE CONSULTA
    console.log('💰 Respaldando pagos de consultas...');
    const queryPayments = await prisma.queryPayment.findMany({
      include: {
        queryGuest: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'queryPayments.json'),
      JSON.stringify(queryPayments, null, 2)
    );
    console.log(`✅ Pagos de consultas respaldados: ${queryPayments.length} registros`);

    // 15. Backup de TARIFAS NOCTURNAS DE CONSULTA
    console.log('🌙 Respaldando tarifas nocturnas de consultas...');
    const queryNightRates = await prisma.queryNightRate.findMany({
      include: {
        query: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'queryNightRates.json'),
      JSON.stringify(queryNightRates, null, 2)
    );
    console.log(`✅ Tarifas nocturnas de consultas respaldadas: ${queryNightRates.length} registros`);

    // 16. Backup de TARIFAS DIARIAS DE HABITACIÓN
    console.log('📊 Respaldando tarifas diarias de habitaciones...');
    const dailyRoomRates = await prisma.dailyRoomRate.findMany({
      include: {
        hotel: true,
        roomType: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'dailyRoomRates.json'),
      JSON.stringify(dailyRoomRates, null, 2)
    );
    console.log(`✅ Tarifas diarias respaldadas: ${dailyRoomRates.length} registros`);

    // 17. Backup de PROMOCIONES DE GAP
    console.log('🎁 Respaldando promociones de gap...');
    const roomGapPromotions = await prisma.roomGapPromotion.findMany({
      include: {
        room: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'roomGapPromotions.json'),
      JSON.stringify(roomGapPromotions, null, 2)
    );
    console.log(`✅ Promociones de gap respaldadas: ${roomGapPromotions.length} registros`);

    // 18. Backup de TARIFAS NOCTURNAS DE RESERVA
    console.log('🌃 Respaldando tarifas nocturnas de reservas...');
    const reservationNightRates = await prisma.reservationNightRate.findMany({
      include: {
        reservation: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'reservationNightRates.json'),
      JSON.stringify(reservationNightRates, null, 2)
    );
    console.log(`✅ Tarifas nocturnas de reservas respaldadas: ${reservationNightRates.length} registros`);

    // 19. Backup de PRECIOS DE TEMPORADA
    console.log('💵 Respaldando precios de temporada...');
    const seasonPrices = await prisma.seasonPrice.findMany({
      include: {
        roomType: true,
        seasonBlock: true,
        serviceType: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'seasonPrices.json'),
      JSON.stringify(seasonPrices, null, 2)
    );
    console.log(`✅ Precios de temporada respaldados: ${seasonPrices.length} registros`);

    // 21. Backup de COEFICIENTES DE PROPORCIÓN
    console.log('📐 Respaldando coeficientes de proporción...');
    const proportionCoefficients = await prisma.proportionCoefficient.findMany({
      include: {
        roomType: true,
        seasonBlock: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'proportionCoefficients.json'),
      JSON.stringify(proportionCoefficients, null, 2)
    );
    console.log(`✅ Coeficientes de proporción respaldados: ${proportionCoefficients.length} registros`);

    // 22. Backup de TIPOS DE SERVICIO
    console.log('🔧 Respaldando tipos de servicio...');
    const serviceTypes = await prisma.serviceType.findMany({
      include: {
        hotel: true,
        blockServiceSelections: true,
        seasonPrices: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'serviceTypes.json'),
      JSON.stringify(serviceTypes, null, 2)
    );
    console.log(`✅ Tipos de servicio respaldados: ${serviceTypes.length} registros`);

    // 23. Backup de SELECCIONES DE SERVICIO DE BLOQUE
    console.log('✅ Respaldando selecciones de servicio de bloque...');
    const blockServiceSelections = await prisma.blockServiceSelection.findMany({
      include: {
        seasonBlock: true,
        serviceType: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'blockServiceSelections.json'),
      JSON.stringify(blockServiceSelections, null, 2)
    );
    console.log(`✅ Selecciones de servicio respaldadas: ${blockServiceSelections.length} registros`);

    // 24. Backup de SEGMENTOS DE RESERVA
    console.log('📏 Respaldando segmentos de reserva...');
    const reservationSegments = await prisma.reservationSegment.findMany({
      include: {
        reservation: true,
        room: true,
        roomType: true,
        virtualRoom: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'reservationSegments.json'),
      JSON.stringify(reservationSegments, null, 2)
    );
    console.log(`✅ Segmentos de reserva respaldados: ${reservationSegments.length} registros`);

    // 25. Backup de HABITACIONES VIRTUALES
    console.log('🏢 Respaldando habitaciones virtuales...');
    const virtualRooms = await prisma.virtualRoom.findMany({
      include: {
        roomType: true,
        components: true,
        segments: true,
        inventory: true,
        rooms: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'virtualRooms.json'),
      JSON.stringify(virtualRooms, null, 2)
    );
    console.log(`✅ Habitaciones virtuales respaldadas: ${virtualRooms.length} registros`);

    // 26. Backup de COMPONENTES DE HABITACIÓN VIRTUAL
    console.log('🧩 Respaldando componentes de habitación virtual...');
    const virtualRoomComponents = await prisma.virtualRoomComponent.findMany({
      include: {
        virtualRoom: true,
        room: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'virtualRoomComponents.json'),
      JSON.stringify(virtualRoomComponents, null, 2)
    );
    console.log(`✅ Componentes de habitación virtual respaldados: ${virtualRoomComponents.length} registros`);

    // 27. Backup de INVENTARIO DE HABITACIONES
    console.log('📦 Respaldando inventario de habitaciones...');
    const roomInventory = await prisma.roomInventory.findMany({
      include: {
        room: true,
        virtualRoom: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'roomInventory.json'),
      JSON.stringify(roomInventory, null, 2)
    );
    console.log(`✅ Inventario de habitaciones respaldado: ${roomInventory.length} registros`);

    // 28. Backup de CONFIGURACIÓN DE PRECIOS DINÁMICOS COMPLETA
    console.log('⚙️ Respaldando configuración completa de precios dinámicos...');
    const dynamicPricingConfigs = await prisma.dynamicPricingConfig.findMany({
      include: {
        hotel: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'dynamicPricingConfigs.json'),
      JSON.stringify(dynamicPricingConfigs, null, 2)
    );
    console.log(`✅ Configuración de precios dinámicos respaldada: ${dynamicPricingConfigs.length} registros`);

    // 29. Backup de HOTELES COMPLETO
    console.log('🏨 Respaldando configuración completa de hoteles...');
    const hotels = await prisma.hotel.findMany({
      include: {
        dailyRoomRates: true,
        dynamicPricingConfig: true,
        openDays: true,
        seasonBlocks: true,
        serviceTypes: true
      }
    });
    
    fs.writeFileSync(
      path.join(backupDir, 'hotels.json'),
      JSON.stringify(hotels, null, 2)
    );
    console.log(`✅ Hoteles respaldados: ${hotels.length} registros`);

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
        openDays: openDays.length,
        guests: guests.length,
        payments: payments.length,
        queryGuests: queryGuests.length,
        queryPayments: queryPayments.length,
        queryNightRates: queryNightRates.length,
        dailyRoomRates: dailyRoomRates.length,
        roomGapPromotions: roomGapPromotions.length,
        reservationNightRates: reservationNightRates.length,
        seasonPrices: seasonPrices.length,
        proportionCoefficients: proportionCoefficients.length,
        serviceTypes: serviceTypes.length,
        blockServiceSelections: blockServiceSelections.length,
        reservationSegments: reservationSegments.length,
        virtualRooms: virtualRooms.length,
        virtualRoomComponents: virtualRoomComponents.length,
        roomInventory: roomInventory.length,
        dynamicPricingConfigs: dynamicPricingConfigs.length,
        hotels: hotels.length
      }
    };

    fs.writeFileSync(
      path.join(backupDir, 'backup-metadata.json'),
      JSON.stringify(summary, null, 2)
    );

    // Guardar resumen en el directorio backups
    fs.writeFileSync(
      path.join(__dirname, 'backups', 'latest-backup-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n🎉 BACKUP COMPLETADO EXITOSAMENTE');
    console.log(`📁 Ubicación: ${backupDir}`);
    console.log('\n📊 RESUMEN COMPLETO DEL BACKUP:');
    console.log('═══════════════════════════════════════════════');
    console.log(`   👥 Clientes: ${clients.length}`);
    console.log(`   👤 Huéspedes: ${guests.length}`);
    console.log(`   💳 Pagos: ${payments.length}`);
    console.log(`   🏨 Habitaciones: ${rooms.length}`);
    console.log(`   🏠 Tipos de habitación: ${roomTypes.length}`);
    console.log(`   🏷️ Etiquetas: ${tags.length}`);
    console.log(`   📋 Reservas: ${reservations.length}`);
    console.log(`   📏 Segmentos de reserva: ${reservationSegments.length}`);
    console.log(`   ❓ Consultas: ${queries.length}`);
    console.log(`   👥 Huéspedes de consultas: ${queryGuests.length}`);
    console.log(`   💰 Pagos de consultas: ${queryPayments.length}`);
    console.log(`   🌙 Tarifas nocturnas de consultas: ${queryNightRates.length}`);
    console.log(`   🏢 Hotel: ${hotel.length}`);
    console.log(`   🏨 Hoteles completos: ${hotels.length}`);
    console.log(`   💰 Configuración de precios: ${dynamicPricing.length}`);
    console.log(`   ⚙️ Configs de precios dinámicos: ${dynamicPricingConfigs.length}`);
    console.log(`   📆 Días abiertos: ${openDays.length}`);
    console.log(`   📊 Tarifas diarias: ${dailyRoomRates.length}`);
    console.log(`   🎁 Promociones de gap: ${roomGapPromotions.length}`);
    console.log(`   🌃 Tarifas nocturnas de reservas: ${reservationNightRates.length}`);
    console.log(`   📅 Bloques de temporada: ${seasonBlocks.length}`);
    console.log(`   💵 Precios de temporada: ${seasonPrices.length}`);
    console.log(`   📐 Coeficientes de proporción: ${proportionCoefficients.length}`);
    console.log(`   🔧 Tipos de servicio: ${serviceTypes.length}`);
    console.log(`   ✅ Selecciones de servicio: ${blockServiceSelections.length}`);
    console.log(`   🏢 Habitaciones virtuales: ${virtualRooms.length}`);
    console.log(`   🧩 Componentes de hab. virtual: ${virtualRoomComponents.length}`);
    console.log(`   📦 Inventario de habitaciones: ${roomInventory.length}`);
    console.log('═══════════════════════════════════════════════');

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
