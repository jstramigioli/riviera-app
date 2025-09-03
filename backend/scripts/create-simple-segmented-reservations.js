const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuración
const CONFIG = {
  targetMonth: 9,
  targetYear: 2025,
  targetOccupationPercentage: 90,
  minDuration: 2,
  maxDuration: 7,
  possibleStatuses: ['confirmada', 'pendiente'],
  statusWeights: [0.8, 0.2]
};

// Función para verificar disponibilidad
async function isRoomAvailable(roomId, startDate, endDate) {
  const conflictingSegments = await prisma.reservationSegment.findMany({
    where: {
      roomId: roomId,
      isActive: true,
      startDate: { lt: endDate },
      endDate: { gt: startDate }
    }
  });
  
  return conflictingSegments.length === 0;
}

// Función para obtener habitaciones disponibles
async function getAvailableRooms() {
  return await prisma.room.findMany({
    where: { status: 'available' },
    include: { roomType: true },
    orderBy: { name: 'asc' }
  });
}

// Función para calcular la ocupación actual
async function calculateCurrentOccupation() {
  const startDate = new Date(CONFIG.targetYear, CONFIG.targetMonth - 1, 1);
  const endDate = new Date(CONFIG.targetYear, CONFIG.targetMonth, 0);
  
  const segments = await prisma.reservationSegment.findMany({
    where: {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      isActive: true
    }
  });
  
  let totalOccupiedDays = 0;
  const daysInMonth = new Date(CONFIG.targetYear, CONFIG.targetMonth, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(CONFIG.targetYear, CONFIG.targetMonth - 1, day);
    let occupiedRooms = 0;
    
    for (const segment of segments) {
      if (currentDate >= segment.startDate && currentDate < segment.endDate) {
        occupiedRooms++;
      }
    }
    
    totalOccupiedDays += occupiedRooms;
  }
  
  return totalOccupiedDays;
}

// Función para crear una reserva simple
async function createSimpleReservation(room, startDate, endDate, client) {
  try {
    // Verificar disponibilidad
    const isAvailable = await isRoomAvailable(room.id, startDate, endDate);
    if (!isAvailable) {
      return null;
    }
    
    // Crear la reserva
    const reservation = await prisma.reservation.create({
      data: {
        mainClientId: client.id,
        status: CONFIG.possibleStatuses[Math.random() < CONFIG.statusWeights[0] ? 0 : 1],
        notes: 'Reserva de prueba - Cliente ficticio',
        isMultiRoom: false
      }
    });
    
    // Crear el segmento
    const segment = await prisma.reservationSegment.create({
      data: {
        reservationId: reservation.id,
        roomId: room.id,
        roomTypeId: room.roomTypeId,
        startDate: startDate,
        endDate: endDate,
        baseRate: 100.0, // Tarifa base por defecto
        guestCount: room.roomType.maxPeople || 2, // Número de huéspedes
        services: [], // Sin servicios adicionales
        isActive: true
      }
    });
    
    return { reservation, segment };
  } catch (error) {
    console.error('Error creando reserva:', error.message);
    return null;
  }
}

// Función principal
async function generateSimpleSegmentedReservations() {
  try {
    console.log('🎯 Generando reservas simples con segmentos...\n');
    
    const rooms = await getAvailableRooms();
    const capacity = rooms.length;
    const daysInMonth = new Date(CONFIG.targetYear, CONFIG.targetMonth, 0).getDate();
    const totalRoomDays = capacity * daysInMonth;
    const targetRoomDays = Math.floor((CONFIG.targetOccupationPercentage / 100) * totalRoomDays);
    
    console.log(`📅 Mes: ${CONFIG.targetMonth}/${CONFIG.targetYear}`);
    console.log(`🏨 Capacidad del hotel: ${capacity} habitaciones`);
    console.log(`📊 Días en el mes: ${daysInMonth}`);
    console.log(`📈 Días-habitación totales: ${totalRoomDays}`);
    console.log(`🎯 Días-habitación objetivo: ${targetRoomDays}`);
    
    // Obtener o crear cliente de prueba
    let client = await prisma.client.findFirst({
      where: { esFicticio: true }
    });
    
    if (!client) {
      client = await prisma.client.create({
        data: {
          firstName: 'Test',
          lastName: 'Cliente1',
          email: 'test.cliente1@ficticio.com',
          phone: '+54 11 1111-1111',
          documentType: 'DNI',
          documentNumber: '52486135',
          country: 'Argentina',
          province: 'Buenos Aires',
          city: 'CABA',
          notes: 'Cliente ficticio para testing - Generado automáticamente',
          wantsPromotions: true,
          esFicticio: true
        }
      });
    }
    
    let currentOccupation = await calculateCurrentOccupation();
    let createdReservations = 0;
    let totalOccupiedDaysCreated = 0;
    let attempts = 0;
    const maxAttempts = 2000;
    
    console.log(`📊 Ocupación actual: ${currentOccupation} días-habitación`);
    console.log(`📈 Días-habitación necesarios: ${targetRoomDays - currentOccupation}\n`);
    
    while (currentOccupation < targetRoomDays && attempts < maxAttempts) {
      attempts++;
      
      // Generar duración aleatoria
      const duration = Math.floor(Math.random() * (CONFIG.maxDuration - CONFIG.minDuration + 1)) + CONFIG.minDuration;
      
      // Generar fecha de inicio aleatoria
      const startDay = Math.floor(Math.random() * (daysInMonth - duration + 1)) + 1;
      const startDate = new Date(CONFIG.targetYear, CONFIG.targetMonth - 1, startDay);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration);
      
      // Seleccionar habitación aleatoria
      const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
      
      // Intentar crear la reserva
      const result = await createSimpleReservation(randomRoom, startDate, endDate, client);
      
      if (result) {
        const roomDays = duration;
        currentOccupation += roomDays;
        totalOccupiedDaysCreated += roomDays;
        createdReservations++;
        
        console.log(`✅ Reserva ${createdReservations} creada: ${randomRoom.name} por ${duration} días (${roomDays} días-habitación)`);
        console.log(`   📅 ${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`);
        console.log(`   📊 Progreso: ${totalOccupiedDaysCreated}/${targetRoomDays - (currentOccupation - roomDays)} días-habitación`);
        
        if (currentOccupation >= targetRoomDays) {
          console.log(`\n🎯 Objetivo de ocupación alcanzado!`);
          break;
        }
      }
      
      // Mostrar progreso cada 100 intentos
      if (attempts % 100 === 0) {
        console.log(`🔄 Intento ${attempts}: ${createdReservations} reservas creadas, ${currentOccupation}/${targetRoomDays} días-habitación`);
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log(`⚠️ Se alcanzó el límite de intentos (${maxAttempts}). No se pudo crear más reservas.`);
    }
    
    // Verificar resultado final
    const finalOccupation = await calculateCurrentOccupation();
    const finalPercentage = ((finalOccupation / totalRoomDays) * 100).toFixed(1);
    
    console.log(`\n🎉 Generación completada!`);
    console.log(`📊 Reservas creadas: ${createdReservations}`);
    console.log(`📈 Días-habitación creados: ${totalOccupiedDaysCreated}`);
    console.log(`📊 Ocupación final: ${finalOccupation} días-habitación (${finalPercentage}%)`);
    console.log(`🎯 Objetivo: ${CONFIG.targetOccupationPercentage}%`);
    
    if (Math.abs(finalPercentage - CONFIG.targetOccupationPercentage) <= 5) {
      console.log(`✅ ¡Objetivo alcanzado con éxito! (Diferencia: ${Math.abs(finalPercentage - CONFIG.targetOccupationPercentage).toFixed(1)}%)`);
    } else {
      console.log(`⚠️ No se pudo alcanzar exactamente el objetivo. Diferencia: ${Math.abs(finalPercentage - CONFIG.targetOccupationPercentage).toFixed(1)}%`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
generateSimpleSegmentedReservations(); 