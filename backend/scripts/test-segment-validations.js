const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Importar las funciones de validación
const {
  hasSegmentOverlap,
  areSegmentsConsecutive,
  validateReservationSegments,
  validateRoomAvailability,
  validateOperationalDays,
  validateReservationCreation
} = require('../src/utils/segmentValidation');

async function testSegmentValidations() {
  try {
    console.log('🧪 Probando validaciones de segmentos...\n');

    // Test 1: Verificar superposición
    console.log('📋 Test 1: Verificar superposición de segmentos');
    const hasOverlap = await hasSegmentOverlap(16, '2025-09-01', '2025-09-05');
    console.log(`   Habitación 16 (17) del 01/09 al 05/09 - Tiene superposición: ${hasOverlap}`);
    
    // Test 2: Verificar segmentos consecutivos
    console.log('\n📋 Test 2: Verificar segmentos consecutivos');
    const segments1 = [
      { startDate: '2025-09-01', endDate: '2025-09-05' },
      { startDate: '2025-09-05', endDate: '2025-09-10' }
    ];
    const segments2 = [
      { startDate: '2025-09-01', endDate: '2025-09-05' },
      { startDate: '2025-09-06', endDate: '2025-09-10' }
    ];
    
    console.log(`   Segmentos consecutivos (01-05, 05-10): ${areSegmentsConsecutive(segments1)}`);
    console.log(`   Segmentos no consecutivos (01-05, 06-10): ${areSegmentsConsecutive(segments2)}`);

    // Test 3: Validar segmentos
    console.log('\n📋 Test 3: Validar segmentos');
    const validSegments = [
      {
        roomId: 16,
        startDate: '2025-09-15',
        endDate: '2025-09-20',
        baseRate: 100.0,
        guestCount: 3
      }
    ];
    
    const invalidSegments = [
      {
        roomId: 16,
        startDate: '2025-09-01',
        endDate: '2025-09-05',
        baseRate: 100.0,
        guestCount: 3
      }
    ];
    
    const validValidation = await validateReservationSegments(validSegments);
    const invalidValidation = await validateReservationSegments(invalidSegments);
    
    console.log(`   Segmentos válidos: ${validValidation.isValid}`);
    if (!validValidation.isValid) {
      console.log(`   Errores: ${validValidation.errors.join(', ')}`);
    }
    
    console.log(`   Segmentos inválidos (con superposición): ${invalidValidation.isValid}`);
    if (!invalidValidation.isValid) {
      console.log(`   Errores: ${invalidValidation.errors.join(', ')}`);
    }

    // Test 4: Validar disponibilidad
    console.log('\n📋 Test 4: Validar disponibilidad');
    const availabilityValidation = await validateRoomAvailability(validSegments);
    console.log(`   Todas las habitaciones disponibles: ${availabilityValidation.allAvailable}`);
    if (!availabilityValidation.allAvailable) {
      console.log(`   Habitaciones no disponibles: ${availabilityValidation.unavailableSegments.map(s => s.roomId).join(', ')}`);
    }

    // Test 5: Validar días operacionales
    console.log('\n📋 Test 5: Validar días operacionales');
    const operationalValidation = await validateOperationalDays(validSegments);
    console.log(`   Todos los días abiertos: ${operationalValidation.allDaysOpen}`);
    if (!operationalValidation.allDaysOpen) {
      console.log(`   Días cerrados: ${operationalValidation.closedDays.map(d => d.date.toLocaleDateString('es-ES')).join(', ')}`);
    }

    // Test 6: Validar creación completa de reserva
    console.log('\n📋 Test 6: Validar creación completa de reserva');
    const reservationData = {
      mainClientId: 1,
      segments: validSegments,
      status: 'active',
      notes: 'Reserva de prueba'
    };
    
    const creationValidation = await validateReservationCreation(reservationData);
    console.log(`   Reserva válida: ${creationValidation.isValid}`);
    if (!creationValidation.isValid) {
      console.log(`   Errores: ${creationValidation.errors.join(', ')}`);
    }

    // Test 7: Probar con segmentos múltiples consecutivos
    console.log('\n📋 Test 7: Probar con segmentos múltiples consecutivos');
    const multiSegments = [
      {
        roomId: 16,
        startDate: '2025-09-25',
        endDate: '2025-09-30',
        baseRate: 100.0,
        guestCount: 3
      },
      {
        roomId: 16,
        startDate: '2025-09-30',
        endDate: '2025-10-05',
        baseRate: 120.0,
        guestCount: 3
      }
    ];
    
    const multiValidation = await validateReservationSegments(multiSegments);
    console.log(`   Segmentos múltiples consecutivos: ${multiValidation.isValid}`);
    if (!multiValidation.isValid) {
      console.log(`   Errores: ${multiValidation.errors.join(', ')}`);
    }

    console.log('\n✅ Pruebas completadas!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar las pruebas
testSegmentValidations(); 