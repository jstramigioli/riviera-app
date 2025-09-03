const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configuración por defecto - se puede modificar fácilmente
const DEFAULT_CONFIG = {
  // Cantidad de reservas a crear
  numReservations: 50,
  
  // Rango de fechas (mes y año)
  targetMonth: 8, // Agosto
  targetYear: 2025,
  
  // Duración de las reservas (en días)
  minDuration: 2,
  maxDuration: 10,
  
  // Distribución de reservas en el mes
  distribution: 'random', // 'random', 'weekends', 'weekdays', 'evenly'
  
  // Probabilidad de que una reserva sea multi-habitación
  multiRoomProbability: 0.1, // 10%
  
  // Número máximo de habitaciones por reserva multi-habitación
  maxRoomsPerReservation: 3,
  
  // Estados de reserva posibles
  possibleStatuses: ['confirmada', 'pendiente', 'cancelada'],
  statusWeights: [0.7, 0.2, 0.1], // 70% confirmadas, 20% pendientes, 10% canceladas
  
  // Tipos de reserva
  reservationTypes: ['con_desayuno', 'media_pension', 'pension_completa'],
  typeWeights: [0.6, 0.3, 0.1], // 60% con desayuno, 30% media pensión, 10% pensión completa
  
  // Notas para las reservas ficticias
  fakeNotes: [
    'Reserva de prueba - Cliente ficticio',
    'Testing - Reserva automática',
    'Cliente ficticio para pruebas',
    'Reserva generada automáticamente',
    'Testing del sistema de reservas'
  ]
};

// Datos de clientes ficticios predefinidos
const FAKE_CLIENTS_DATA = [
  { firstName: 'Juan', lastName: 'Pérez', email: 'juan.perez@test.com', phone: '+54 11 1234-5678', city: 'CABA' },
  { firstName: 'María', lastName: 'González', email: 'maria.gonzalez@test.com', phone: '+54 11 2345-6789', city: 'Córdoba' },
  { firstName: 'Carlos', lastName: 'Rodríguez', email: 'carlos.rodriguez@test.com', phone: '+54 11 3456-7890', city: 'Mendoza' },
  { firstName: 'Ana', lastName: 'López', email: 'ana.lopez@test.com', phone: '+54 11 4567-8901', city: 'Rosario' },
  { firstName: 'Roberto', lastName: 'Martínez', email: 'roberto.martinez@test.com', phone: '+54 11 5678-9012', city: 'Tucumán' },
  { firstName: 'Laura', lastName: 'Fernández', email: 'laura.fernandez@test.com', phone: '+54 11 6789-0123', city: 'Paraná' },
  { firstName: 'Diego', lastName: 'Sánchez', email: 'diego.sanchez@test.com', phone: '+54 11 7890-1234', city: 'Salta' },
  { firstName: 'Sofía', lastName: 'Torres', email: 'sofia.torres@test.com', phone: '+54 11 8901-2345', city: 'Resistencia' },
  { firstName: 'Miguel', lastName: 'Ramírez', email: 'miguel.ramirez@test.com', phone: '+54 11 9012-3456', city: 'Posadas' },
  { firstName: 'Valentina', lastName: 'Castro', email: 'valentina.castro@test.com', phone: '+54 11 0123-4567', city: 'La Rioja' }
];

// Función para generar fechas según la distribución especificada
function generateDates(config) {
  const dates = [];
  const year = config.targetYear;
  const month = config.targetMonth;
  
  // Obtener el primer y último día del mes
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  
  let availableDates = [];
  
  // Generar todas las fechas disponibles del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
    
    let includeDate = false;
    
    switch (config.distribution) {
      case 'random':
        includeDate = true;
        break;
      case 'weekends':
        includeDate = dayOfWeek === 0 || dayOfWeek === 6; // Domingo o Sábado
        break;
      case 'weekdays':
        includeDate = dayOfWeek >= 1 && dayOfWeek <= 5; // Lunes a Viernes
        break;
      case 'evenly':
        // Distribuir uniformemente en el mes
        const weekNumber = Math.floor((day - 1) / 7);
        const dayInWeek = day % 7;
        includeDate = dayInWeek === 1 || dayInWeek === 3 || dayInWeek === 5; // Lunes, Miércoles, Viernes
        break;
      default:
        includeDate = true;
    }
    
    if (includeDate) {
      availableDates.push(date);
    }
  }
  
  // Si no hay suficientes fechas disponibles, duplicar algunas
  while (availableDates.length < config.numReservations) {
    const randomDate = new Date(year, month - 1, Math.floor(Math.random() * daysInMonth) + 1);
    availableDates.push(randomDate);
  }
  
  // Mezclar las fechas para mayor aleatoriedad
  availableDates.sort(() => 0.5 - Math.random());
  
  // Seleccionar fechas para las reservas
  for (let i = 0; i < config.numReservations; i++) {
    const checkInDate = availableDates[i % availableDates.length];
    
    // Generar duración aleatoria
    const duration = Math.floor(Math.random() * (config.maxDuration - config.minDuration + 1)) + config.minDuration;
    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkOutDate.getDate() + duration);
    
    dates.push({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      duration: duration
    });
  }
  
  return dates;
}

// Función para seleccionar aleatoriamente basado en pesos
function weightedRandom(items, weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  return items[items.length - 1];
}

// Función para crear o obtener un cliente ficticio
async function getOrCreateFakeClient() {
  // Primero intentar obtener un cliente ficticio existente
  const existingFakeClients = await prisma.client.findMany({
    where: { esFicticio: true },
    take: 100
  });
  
  if (existingFakeClients.length > 0) {
    // Seleccionar uno aleatorio de los existentes
    return existingFakeClients[Math.floor(Math.random() * existingFakeClients.length)];
  }
  
  // Si no hay clientes ficticios, crear uno nuevo
  const clientData = FAKE_CLIENTS_DATA[Math.floor(Math.random() * FAKE_CLIENTS_DATA.length)];
  
  try {
    return await prisma.client.create({
      data: {
        ...clientData,
        documentType: 'DNI',
        documentNumber: (Math.floor(Math.random() * 90000000) + 10000000).toString(),
        country: 'Argentina',
        province: 'Buenos Aires',
        notes: 'Cliente ficticio generado automáticamente para testing',
        wantsPromotions: Math.random() > 0.5,
        esFicticio: true
      }
    });
  } catch (error) {
    console.log('⚠️  Error al crear cliente ficticio, intentando crear otro...');
    
    // Intentar con otro cliente de la lista
    const anotherClientData = FAKE_CLIENTS_DATA[Math.floor(Math.random() * FAKE_CLIENTS_DATA.length)];
    
    try {
      return await prisma.client.create({
        data: {
          ...anotherClientData,
          documentType: 'DNI',
          documentNumber: (Math.floor(Math.random() * 90000000) + 10000000).toString(),
          country: 'Argentina',
          province: 'Buenos Aires',
          notes: 'Cliente ficticio generado automáticamente para testing',
          wantsPromotions: Math.random() > 0.5,
          esFicticio: true
        }
      });
    } catch (secondError) {
      console.log('❌ Error al crear cliente ficticio, abortando...');
      throw secondError;
    }
  }
}

// Función para obtener habitaciones disponibles
async function getAvailableRooms() {
  return await prisma.room.findMany({
    where: { status: 'available' },
    include: {
      roomType: true
    }
  });
}

// Función para crear una reserva
async function createReservation(reservationData, config) {
  try {
    // Obtener cliente ficticio
    const client = await getOrCreateFakeClient();
    
    // Obtener habitaciones disponibles
    const availableRooms = await getAvailableRooms();
    
    if (availableRooms.length === 0) {
      console.log('⚠️  No hay habitaciones disponibles para crear reservas');
      return null;
    }
    
    // Determinar si es reserva multi-habitación
    const isMultiRoom = Math.random() < config.multiRoomProbability && availableRooms.length > 1;
    
    let selectedRooms = [];
    if (isMultiRoom) {
      // Seleccionar múltiples habitaciones
      const numRooms = Math.min(
        Math.floor(Math.random() * config.maxRoomsPerReservation) + 1,
        availableRooms.length
      );
      
      // Mezclar y seleccionar habitaciones aleatorias
      const shuffledRooms = availableRooms.sort(() => 0.5 - Math.random());
      selectedRooms = shuffledRooms.slice(0, numRooms);
    } else {
      // Seleccionar una sola habitación
      selectedRooms = [availableRooms[Math.floor(Math.random() * availableRooms.length)]];
    }
    
    // Crear la reserva principal
    const reservation = await prisma.reservation.create({
      data: {
        mainClientId: client.id,
        status: weightedRandom(config.possibleStatuses, config.statusWeights),
        notes: config.fakeNotes[Math.floor(Math.random() * config.fakeNotes.length)],
        isMultiRoom: isMultiRoom,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // Crear segmentos de reserva para cada habitación
    for (const room of selectedRooms) {
      await prisma.reservationSegment.create({
        data: {
          reservationId: reservation.id,
          roomId: room.id,
          roomTypeId: room.roomTypeId,
          startDate: reservationData.checkIn,
          endDate: reservationData.checkOut,
          services: ['con_desayuno'],
          baseRate: 100.0, // Tarifa base por defecto
          guestCount: Math.floor(Math.random() * 4) + 1, // 1-4 huéspedes
          notes: 'Segmento de reserva ficticia para testing',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
    
    // Por ahora no creamos huéspedes para evitar problemas de IDs duplicados
    const numGuests = Math.floor(Math.random() * 4) + 1; // 1-4 huéspedes (solo para estadísticas)
    
    return {
      reservation,
      client,
      rooms: selectedRooms,
      numGuests
    };
    
  } catch (error) {
    console.error('❌ Error al crear reserva:', error);
    return null;
  }
}

// Función principal para crear reservas ficticias
async function createFakeReservations(customConfig = {}) {
  try {
    // Combinar configuración por defecto con configuración personalizada
    const config = { ...DEFAULT_CONFIG, ...customConfig };
    
    console.log('🚀 Iniciando creación de reservas ficticias...');
    console.log('\n📋 Configuración:');
    console.log(`   - Cantidad de reservas: ${config.numReservations}`);
    console.log(`   - Mes objetivo: ${config.targetMonth}/${config.targetYear}`);
    console.log(`   - Duración: ${config.minDuration}-${config.maxDuration} días`);
    console.log(`   - Distribución: ${config.distribution}`);
    console.log(`   - Probabilidad multi-habitación: ${config.multiRoomProbability * 100}%`);
    
    // Generar fechas de reserva
    const reservationDates = generateDates(config);
    
    if (reservationDates.length === 0) {
      console.log('❌ No se pudieron generar fechas válidas para las reservas');
      return;
    }
    
    console.log(`\n📅 Fechas generadas: ${reservationDates.length} reservas`);
    
    // Crear las reservas
    const createdReservations = [];
    let failedReservations = 0;
    
    for (let i = 0; i < reservationDates.length; i++) {
      const reservationData = reservationDates[i];
      
      console.log(`\n📝 Creando reserva ${i + 1}/${reservationDates.length}...`);
      console.log(`   Check-in: ${reservationData.checkIn.toLocaleDateString()}`);
      console.log(`   Check-out: ${reservationData.checkOut.toLocaleDateString()}`);
      console.log(`   Duración: ${reservationData.duration} días`);
      
      const result = await createReservation(reservationData, config);
      
      if (result) {
        createdReservations.push(result);
        console.log(`   ✅ Reserva creada - Cliente: ${result.client.firstName} ${result.client.lastName}`);
        console.log(`   🏠 Habitaciones: ${result.rooms.map(r => r.name).join(', ')}`);
        console.log(`   👥 Huéspedes: ${result.numGuests}`);
      } else {
        failedReservations++;
        console.log(`   ❌ Error al crear reserva`);
      }
    }
    
    // Mostrar resumen final
    console.log('\n🎉 Resumen de creación de reservas ficticias:');
    console.log(`   ✅ Reservas creadas exitosamente: ${createdReservations.length}`);
    console.log(`   ❌ Reservas fallidas: ${failedReservations}`);
    console.log(`   👥 Total de clientes ficticios utilizados: ${new Set(createdReservations.map(r => r.client.id)).size}`);
    console.log(`   🏠 Total de habitaciones utilizadas: ${new Set(createdReservations.flatMap(r => r.rooms.map(room => room.id))).size}`);
    
    // Estadísticas adicionales
    const statusCounts = {};
    const typeCounts = {};
    
    createdReservations.forEach(r => {
      statusCounts[r.reservation.status] = (statusCounts[r.reservation.status] || 0) + 1;
      typeCounts[r.reservation.isMultiRoom ? 'multi-habitación' : 'individual'] = 
        (typeCounts[r.reservation.isMultiRoom ? 'multi-habitación' : 'individual'] || 0) + 1;
    });
    
    console.log('\n📊 Estadísticas por estado:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });
    
    console.log('\n📊 Estadísticas por tipo:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para limpiar todas las reservas ficticias
async function cleanFakeReservations() {
  try {
    console.log('🧹 Limpiando reservas ficticias...');
    
    // Obtener todos los clientes ficticios
    const fakeClients = await prisma.client.findMany({
      where: { esFicticio: true },
      select: { id: true }
    });
    
    if (fakeClients.length === 0) {
      console.log('ℹ️  No hay clientes ficticios para limpiar');
      return;
    }
    
    const fakeClientIds = fakeClients.map(c => c.id);
    
    // Eliminar reservas de clientes ficticios
    const deletedReservations = await prisma.reservation.deleteMany({
      where: {
        mainClientId: { in: fakeClientIds }
      }
    });
    
    console.log(`✅ Se eliminaron ${deletedReservations.count} reservas ficticias`);
    
  } catch (error) {
    console.error('❌ Error al limpiar reservas ficticias:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para mostrar configuración actual
function showConfig() {
  console.log('📋 Configuración actual:');
  console.log(JSON.stringify(DEFAULT_CONFIG, null, 2));
}

// Ejecutar según los argumentos pasados
const action = process.argv[2];

switch (action) {
  case 'create':
    // Permitir configuración personalizada desde argumentos
    const customConfig = {};
    
    // Parsear argumentos adicionales
    for (let i = 3; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        if (key && value) {
          // Convertir tipos de datos
          if (['numReservations', 'targetMonth', 'targetYear', 'minDuration', 'maxDuration', 'maxRoomsPerReservation'].includes(key)) {
            customConfig[key] = parseInt(value);
          } else if (['multiRoomProbability'].includes(key)) {
            customConfig[key] = parseFloat(value);
          } else {
            customConfig[key] = value;
          }
        }
      }
    }
    
    createFakeReservations(customConfig);
    break;
    
  case 'clean':
    cleanFakeReservations();
    break;
    
  case 'config':
    showConfig();
    break;
    
  default:
    console.log('📖 Uso del script:');
    console.log('');
    console.log('   node create-fake-reservations.js create [opciones]');
    console.log('   node create-fake-reservations.js clean');
    console.log('   node create-fake-reservations.js config');
    console.log('');
    console.log('📋 Opciones disponibles:');
    console.log('   --numReservations=50          Cantidad de reservas a crear');
    console.log('   --targetMonth=8               Mes objetivo (1-12)');
    console.log('   --targetYear=2025             Año objetivo');
    console.log('   --minDuration=2               Duración mínima en días');
    console.log('   --maxDuration=10              Duración máxima en días');
    console.log('   --distribution=random         Distribución: random, weekends, weekdays, evenly');
    console.log('   --multiRoomProbability=0.1    Probabilidad de reserva multi-habitación (0-1)');
    console.log('');
    console.log('📝 Ejemplos:');
    console.log('   node create-fake-reservations.js create');
    console.log('   node create-fake-reservations.js create --numReservations=100 --targetMonth=9');
    console.log('   node create-fake-reservations.js create --distribution=weekends --minDuration=3 --maxDuration=7');
    console.log('   node create-fake-reservations.js clean');
    process.exit(0);
} 