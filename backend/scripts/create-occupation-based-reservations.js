const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuración por defecto
const DEFAULT_CONFIG = {
  targetMonth: 9, // Septiembre
  targetYear: 2025,
  minDuration: 2,
  maxDuration: 10,
  multiRoomProbability: 0.1,
  maxRoomsPerReservation: 3,
  possibleStatuses: ['confirmada', 'pendiente', 'cancelada'],
  statusWeights: [0.7, 0.2, 0.1], // 70% confirmada, 20% pendiente, 10% cancelada
  fakeNotes: [
    'Reserva de prueba - Cliente ficticio',
    'Testing del sistema de reservas',
    'Cliente ficticio para pruebas',
    'Reserva generada automáticamente',
    'Testing - Reserva automática'
  ]
};

// Función para calcular la capacidad total del hotel
async function calculateHotelCapacity() {
  const rooms = await prisma.room.findMany({
    where: { status: 'available' },
    include: { roomType: true }
  });
  
  return rooms.length;
}

// Función para calcular la ocupación actual
async function calculateCurrentOccupation(targetMonth, targetYear) {
  const startDate = new Date(targetYear, targetMonth - 1, 1);
  const endDate = new Date(targetYear, targetMonth, 0); // Último día del mes
  
  const segments = await prisma.reservationSegment.findMany({
    where: {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      isActive: true
    },
    include: {
      reservation: {
        include: {
          mainClient: true
        }
      }
    }
  });
  
  // Calcular días ocupados por cada segmento
  let totalOccupiedDays = 0;
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(targetYear, targetMonth - 1, day);
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

// Función para verificar si una habitación está disponible en un rango de fechas
async function isRoomAvailable(roomId, startDate, endDate) {
  const conflictingSegments = await prisma.reservationSegment.findMany({
    where: {
      roomId: roomId,
      startDate: { lt: endDate },
      endDate: { gt: startDate },
      isActive: true
    }
  });
  
  return conflictingSegments.length === 0;
}

// Función para obtener habitaciones disponibles en un rango de fechas
async function getAvailableRooms(startDate, endDate, count = 1) {
  const allRooms = await prisma.room.findMany({
    where: { status: 'available' },
    include: { roomType: true }
  });
  
  const availableRooms = [];
  
  for (const room of allRooms) {
    if (await isRoomAvailable(room.id, startDate, endDate)) {
      availableRooms.push(room);
      if (availableRooms.length >= count) break;
    }
  }
  
  return availableRooms;
}

// Función para crear o obtener un cliente ficticio
async function getOrCreateFakeClient() {
  // Buscar un cliente ficticio existente
  const existingFakeClient = await prisma.client.findFirst({
    where: { esFicticio: true }
  });
  
  if (existingFakeClient) {
    return existingFakeClient;
  }
  
  // Si no hay clientes ficticios, crear uno nuevo
  const fakeNames = [
    'Test Cliente1', 'Test Cliente2', 'Test Cliente3', 'Test Cliente4', 'Test Cliente5',
    'Test Cliente6', 'Test Cliente7', 'Test Cliente8', 'Test Cliente9', 'Test Cliente10',
    'Test Cliente11', 'Test Cliente12', 'Test Cliente13', 'Test Cliente14', 'Test Cliente15'
  ];
  
  const randomName = fakeNames[Math.floor(Math.random() * fakeNames.length)];
  const randomDocument = Math.floor(Math.random() * 99999999) + 10000000;
  
  try {
    return await prisma.client.create({
      data: {
        name: randomName,
        email: `${randomName.toLowerCase().replace(' ', '')}@test.com`,
        phone: `+54${Math.floor(Math.random() * 999999999) + 100000000}`,
        documentType: 'DNI',
        documentNumber: String(randomDocument),
        esFicticio: true
      }
    });
  } catch (error) {
    // Si hay conflicto de ID, intentar con otro documento
    return await getOrCreateFakeClient();
  }
}

// Función para generar fechas aleatorias
function generateRandomDates(targetMonth, targetYear, minDuration, maxDuration) {
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const duration = Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;
  
  // Asegurar que la reserva termine dentro del mes
  const maxStartDay = daysInMonth - duration + 1;
  const startDay = Math.floor(Math.random() * maxStartDay) + 1;
  
  const startDate = new Date(targetYear, targetMonth - 1, startDay);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + duration);
  
  return { startDate, endDate, duration };
}

// Función para crear una reserva
async function createReservation(client, startDate, endDate, rooms, status, notes) {
  const reservation = await prisma.reservation.create({
    data: {
      mainClientId: client.id,
      status: status,
      isMultiRoom: rooms.length > 1,
      notes: notes
    }
  });
  
  const segments = [];
  
  for (const room of rooms) {
    const segment = await prisma.reservationSegment.create({
      data: {
        reservationId: reservation.id,
        roomId: room.id,
        roomTypeId: room.roomTypeId,
        startDate: startDate,
        endDate: endDate,
        services: [],
        baseRate: Math.floor(Math.random() * 50000) + 20000, // $20,000 - $70,000
        guestCount: Math.floor(Math.random() * 4) + 1, // 1-4 huéspedes
        notes: notes,
        isActive: true
      }
    });
    segments.push(segment);
  }
  
  return { reservation, segments };
}

// Función para generar reservas hasta alcanzar el porcentaje objetivo
async function generateReservationsForOccupation(targetOccupationPercentage, config = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log(`🎯 Generando reservas para alcanzar ${targetOccupationPercentage}% de ocupación...`);
  console.log(`📅 Mes: ${finalConfig.targetMonth}/${finalConfig.targetYear}`);
  
  const capacity = await calculateHotelCapacity();
  const daysInMonth = new Date(finalConfig.targetYear, finalConfig.targetMonth, 0).getDate();
  const totalRoomDays = capacity * daysInMonth;
  const targetOccupiedDays = Math.floor((targetOccupationPercentage / 100) * totalRoomDays);
  
  console.log(`🏨 Capacidad del hotel: ${capacity} habitaciones`);
  console.log(`📊 Días en el mes: ${daysInMonth}`);
  console.log(`📈 Días-habitación totales: ${totalRoomDays}`);
  console.log(`🎯 Días-habitación objetivo: ${targetOccupiedDays}`);
  
  const currentOccupation = await calculateCurrentOccupation(finalConfig.targetMonth, finalConfig.targetYear);
  console.log(`📊 Ocupación actual: ${currentOccupation} días-habitación`);
  
  const neededOccupation = targetOccupiedDays - currentOccupation;
  
  if (neededOccupation <= 0) {
    console.log(`✅ Ya se alcanzó el objetivo de ocupación (${targetOccupationPercentage}%)`);
    return;
  }
  
  console.log(`📈 Días-habitación necesarios: ${neededOccupation}`);
  
  let createdReservations = 0;
  let totalOccupiedDaysCreated = 0;
  let attempts = 0;
  const maxAttempts = neededOccupation * 10; // Límite de intentos para evitar bucle infinito
  
  while (totalOccupiedDaysCreated < neededOccupation && attempts < maxAttempts) {
    attempts++;
    
    // Generar fechas aleatorias
    const { startDate, endDate, duration } = generateRandomDates(
      finalConfig.targetMonth, 
      finalConfig.targetYear, 
      finalConfig.minDuration, 
      finalConfig.maxDuration
    );
    
    // Determinar si es reserva multi-habitación
    const isMultiRoom = Math.random() < finalConfig.multiRoomProbability;
    const roomCount = isMultiRoom ? 
      Math.floor(Math.random() * (finalConfig.maxRoomsPerReservation - 1)) + 2 : 1;
    
    // Obtener habitaciones disponibles
    const availableRooms = await getAvailableRooms(startDate, endDate, roomCount);
    
    if (availableRooms.length === 0) {
      continue; // No hay habitaciones disponibles, intentar con otras fechas
    }
    
    // Usar solo las habitaciones disponibles
    const selectedRooms = availableRooms.slice(0, roomCount);
    
    // Crear cliente ficticio
    const client = await getOrCreateFakeClient();
    
    // Seleccionar estado aleatorio
    const randomValue = Math.random();
    let statusIndex = 0;
    let cumulativeWeight = 0;
    
    for (let i = 0; i < finalConfig.statusWeights.length; i++) {
      cumulativeWeight += finalConfig.statusWeights[i];
      if (randomValue <= cumulativeWeight) {
        statusIndex = i;
        break;
      }
    }
    
    const status = finalConfig.possibleStatuses[statusIndex];
    const notes = finalConfig.fakeNotes[Math.floor(Math.random() * finalConfig.fakeNotes.length)];
    
    try {
      const { reservation, segments } = await createReservation(
        client, startDate, endDate, selectedRooms, status, notes
      );
      
      const occupiedDaysForThisReservation = selectedRooms.length * duration;
      totalOccupiedDaysCreated += occupiedDaysForThisReservation;
      createdReservations++;
      
      console.log(`✅ Reserva ${createdReservations} creada: ${selectedRooms.length} habitación(es) por ${duration} días (${occupiedDaysForThisReservation} días-habitación)`);
      console.log(`   📅 ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
      console.log(`   🏨 Habitaciones: ${selectedRooms.map(r => r.number).join(', ')}`);
      console.log(`   📊 Progreso: ${totalOccupiedDaysCreated}/${neededOccupation} días-habitación`);
      
      // Verificar si ya alcanzamos el objetivo
      if (totalOccupiedDaysCreated >= neededOccupation) {
        break;
      }
      
    } catch (error) {
      console.log(`❌ Error creando reserva: ${error.message}`);
      continue;
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log(`⚠️ Se alcanzó el límite de intentos (${maxAttempts}). No se pudo crear más reservas.`);
  }
  
  // Verificar resultado final
  const finalOccupation = await calculateCurrentOccupation(finalConfig.targetMonth, finalConfig.targetYear);
  const finalPercentage = ((finalOccupation / totalRoomDays) * 100).toFixed(1);
  
  console.log(`\n🎉 Generación completada!`);
  console.log(`📊 Reservas creadas: ${createdReservations}`);
  console.log(`📈 Días-habitación creados: ${totalOccupiedDaysCreated}`);
  console.log(`📊 Ocupación final: ${finalOccupation} días-habitación (${finalPercentage}%)`);
  console.log(`🎯 Objetivo: ${targetOccupationPercentage}%`);
  
  if (Math.abs(finalPercentage - targetOccupationPercentage) <= 5) {
    console.log(`✅ ¡Objetivo alcanzado con éxito! (Diferencia: ${Math.abs(finalPercentage - targetOccupationPercentage).toFixed(1)}%)`);
  } else {
    console.log(`⚠️ No se pudo alcanzar exactamente el objetivo. Diferencia: ${Math.abs(finalPercentage - targetOccupationPercentage).toFixed(1)}%`);
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('❌ Comando requerido: analyze o create');
    console.log('📖 Uso: node scripts/create-occupation-based-reservations.js <comando> [opciones]');
    console.log('');
    console.log('Comandos disponibles:');
    console.log('  analyze [--month=9] [--year=2025]     - Analizar ocupación actual');
    console.log('  create --targetOccupationPercentage=90 [--month=9] [--year=2025] - Generar reservas para alcanzar el porcentaje');
    console.log('');
    console.log('Ejemplos:');
    console.log('  node scripts/create-occupation-based-reservations.js analyze');
    console.log('  node scripts/create-occupation-based-reservations.js create --targetOccupationPercentage=90');
    console.log('  node scripts/create-occupation-based-reservations.js create --targetOccupationPercentage=75 --month=10 --year=2025');
    return;
  }
  
  try {
    if (command === 'analyze') {
      // Parsear argumentos para analyze
      const month = parseInt(args.find(arg => arg.startsWith('--month='))?.split('=')[1]) || DEFAULT_CONFIG.targetMonth;
      const year = parseInt(args.find(arg => arg.startsWith('--year='))?.split('=')[1]) || DEFAULT_CONFIG.targetYear;
      
      console.log(`📊 Analizando ocupación para ${month}/${year}...\n`);
      
      const capacity = await calculateHotelCapacity();
      const daysInMonth = new Date(year, month, 0).getDate();
      const totalRoomDays = capacity * daysInMonth;
      const currentOccupation = await calculateCurrentOccupation(month, year);
      const percentage = ((currentOccupation / totalRoomDays) * 100).toFixed(1);
      
      console.log(`🏨 Capacidad del hotel: ${capacity} habitaciones`);
      console.log(`📅 Días en el mes: ${daysInMonth}`);
      console.log(`📊 Días-habitación totales: ${totalRoomDays}`);
      console.log(`📈 Días-habitación ocupados: ${currentOccupation}`);
      console.log(`📊 Porcentaje de ocupación: ${percentage}%`);
      
    } else if (command === 'create') {
      // Parsear argumentos para create
      const targetPercentage = parseFloat(args.find(arg => arg.startsWith('--targetOccupationPercentage='))?.split('=')[1]);
      
      if (!targetPercentage || targetPercentage <= 0 || targetPercentage > 100) {
        console.log('❌ Error: --targetOccupationPercentage es requerido y debe estar entre 1 y 100');
        return;
      }
      
      const month = parseInt(args.find(arg => arg.startsWith('--month='))?.split('=')[1]) || DEFAULT_CONFIG.targetMonth;
      const year = parseInt(args.find(arg => arg.startsWith('--year='))?.split('=')[1]) || DEFAULT_CONFIG.targetYear;
      
      await generateReservationsForOccupation(targetPercentage, {
        targetMonth: month,
        targetYear: year
      });
      
    } else {
      console.log('❌ Comando no válido. Use "analyze" o "create"');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main();
}

module.exports = {
  calculateHotelCapacity,
  calculateCurrentOccupation,
  generateReservationsForOccupation
};