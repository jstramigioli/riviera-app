const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuración
const CONFIG = {
  targetMonth: 9,
  targetYear: 2025,
  targetOccupationPercentage: 90,
  minDuration: 2,
  maxDuration: 10,
  possibleStatuses: ['confirmada', 'pendiente'],
  statusWeights: [0.8, 0.2], // 80% confirmada, 20% pendiente
  fakeNotes: [
    'Reserva de prueba - Cliente ficticio',
    'Testing del sistema de reservas',
    'Cliente ficticio para pruebas',
    'Reserva generada automáticamente',
    'Testing - Reserva automática'
  ]
};

// Función para verificar si hay superposición de segmentos
async function hasOverlap(roomId, startDate, endDate, excludeReservationId = null) {
  const conflictingSegments = await prisma.reservationSegment.findMany({
    where: {
      roomId: roomId,
      isActive: true,
      startDate: { lt: endDate },
      endDate: { gt: startDate },
      ...(excludeReservationId && { reservationId: { not: excludeReservationId } })
    }
  });
  
  return conflictingSegments.length > 0;
}

// Función para verificar si los segmentos son sucesivos
function areSegmentsConsecutive(segments) {
  if (segments.length <= 1) return true;
  
  const sortedSegments = segments.sort((a, b) => a.startDate - b.startDate);
  
  for (let i = 0; i < sortedSegments.length - 1; i++) {
    const currentEnd = new Date(sortedSegments[i].endDate);
    const nextStart = new Date(sortedSegments[i + 1].startDate);
    
    // Los segmentos deben ser consecutivos (el día de fin = día de inicio del siguiente)
    if (currentEnd.getTime() !== nextStart.getTime()) {
      return false;
    }
  }
  
  return true;
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

// Función para crear una reserva con segmentos
async function createReservationWithSegments(segments, client) {
  try {
    // Verificar que los segmentos sean consecutivos
    if (!areSegmentsConsecutive(segments)) {
      throw new Error('Los segmentos no son consecutivos');
    }
    
    // Verificar que no haya superposición en ningún segmento
    for (const segment of segments) {
      const hasConflict = await hasOverlap(segment.roomId, segment.startDate, segment.endDate);
      if (hasConflict) {
        throw new Error(`Superposición detectada en habitación ${segment.roomId}`);
      }
    }
    
    // Crear la reserva
    const reservation = await prisma.reservation.create({
      data: {
        mainClientId: client.id,
        status: CONFIG.possibleStatuses[Math.random() < CONFIG.statusWeights[0] ? 0 : 1],
        notes: CONFIG.fakeNotes[Math.floor(Math.random() * CONFIG.fakeNotes.length)],
        isMultiRoom: segments.length > 1
      }
    });
    
    // Crear los segmentos
    const createdSegments = [];
    for (const segment of segments) {
      const createdSegment = await prisma.reservationSegment.create({
        data: {
          reservationId: reservation.id,
          roomId: segment.roomId,
          roomTypeId: segment.roomTypeId,
          startDate: segment.startDate,
          endDate: segment.endDate,
          isActive: true
        }
      });
      createdSegments.push(createdSegment);
    }
    
    return { reservation, segments: createdSegments };
  } catch (error) {
    throw error;
  }
}

// Función principal para generar reservas
async function generateSegmentedReservations() {
  try {
    console.log('🎯 Generando reservas con segmentos...\n');
    
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
    const maxAttempts = 1000;
    
    console.log(`📊 Ocupación actual: ${currentOccupation} días-habitación`);
    console.log(`📈 Días-habitación necesarios: ${targetRoomDays - currentOccupation}\n`);
    
    while (currentOccupation < targetRoomDays && attempts < maxAttempts) {
      attempts++;
      
      try {
        // Generar duración aleatoria
        const duration = Math.floor(Math.random() * (CONFIG.maxDuration - CONFIG.minDuration + 1)) + CONFIG.minDuration;
        
        // Generar fecha de inicio aleatoria
        const startDay = Math.floor(Math.random() * (daysInMonth - duration + 1)) + 1;
        const startDate = new Date(CONFIG.targetYear, CONFIG.targetMonth - 1, startDay);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration);
        
        // Decidir si es multi-habitación (20% de probabilidad)
        const isMultiRoom = Math.random() < 0.2 && duration >= 3;
        const numRooms = isMultiRoom ? Math.floor(Math.random() * 2) + 2 : 1; // 2-3 habitaciones
        
        // Seleccionar habitaciones aleatorias
        const selectedRooms = [];
        const shuffledRooms = [...rooms].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < numRooms && i < shuffledRooms.length; i++) {
          selectedRooms.push(shuffledRooms[i]);
        }
        
        // Crear segmentos
        const segments = [];
        for (const room of selectedRooms) {
          segments.push({
            roomId: room.id,
            roomTypeId: room.roomTypeId,
            startDate: startDate,
            endDate: endDate
          });
        }
        
        // Crear la reserva
        const result = await createReservationWithSegments(segments, client);
        
        const roomDays = duration * selectedRooms.length;
        currentOccupation += roomDays;
        totalOccupiedDaysCreated += roomDays;
        createdReservations++;
        
        console.log(`✅ Reserva ${createdReservations} creada: ${selectedRooms.length} habitación(es) por ${duration} días (${roomDays} días-habitación)`);
        console.log(`   📅 ${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`);
        console.log(`   🏨 Habitaciones: ${selectedRooms.map(r => r.name).join(', ')}`);
        console.log(`   📊 Progreso: ${totalOccupiedDaysCreated}/${targetRoomDays - (currentOccupation - roomDays)} días-habitación`);
        
        if (currentOccupation >= targetRoomDays) {
          console.log(`\n🎯 Objetivo de ocupación alcanzado!`);
          break;
        }
        
      } catch (error) {
        // Si hay conflicto, continuar con el siguiente intento
        continue;
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
generateSegmentedReservations(); 