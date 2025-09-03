const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Verifica si hay superposición de segmentos en una habitación
 */
async function hasSegmentOverlap(roomId, startDate, endDate, excludeReservationId = null) {
  const conflictingSegments = await prisma.reservationSegment.findMany({
    where: {
      roomId: parseInt(roomId),
      isActive: true,
      startDate: { lt: new Date(endDate) },
      endDate: { gt: new Date(startDate) },
      ...(excludeReservationId && { 
        reservationId: { not: parseInt(excludeReservationId) } 
      })
    }
  });
  
  return conflictingSegments.length > 0;
}

/**
 * Verifica si los segmentos de una reserva son consecutivos
 */
function areSegmentsConsecutive(segments) {
  if (segments.length <= 1) return true;
  
  const sortedSegments = segments.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  
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

/**
 * Valida que una reserva cumpla con todas las reglas de segmentos
 */
async function validateReservationSegments(segments, excludeReservationId = null) {
  const errors = [];
  
  // Verificar que hay al menos un segmento
  if (!segments || segments.length === 0) {
    errors.push('La reserva debe tener al menos un segmento');
    return { isValid: false, errors };
  }
  
  // Verificar que los segmentos sean consecutivos
  if (!areSegmentsConsecutive(segments)) {
    errors.push('Los segmentos de una reserva deben ser consecutivos');
  }
  
  // Verificar que no haya superposición en ningún segmento
  for (const segment of segments) {
    const hasOverlap = await hasSegmentOverlap(
      segment.roomId, 
      segment.startDate, 
      segment.endDate, 
      excludeReservationId
    );
    
    if (hasOverlap) {
      errors.push(`Superposición detectada en habitación ${segment.roomId} del ${segment.startDate} al ${segment.endDate}`);
    }
  }
  
  // Verificar que las fechas sean válidas
  for (const segment of segments) {
    const startDate = new Date(segment.startDate);
    const endDate = new Date(segment.endDate);
    
    if (startDate >= endDate) {
      errors.push(`Fecha de inicio debe ser anterior a fecha de fin en segmento de habitación ${segment.roomId}`);
    }
    
    if (startDate < new Date()) {
      errors.push(`No se pueden crear reservas en fechas pasadas`);
    }
  }
  
  // Verificar que los campos obligatorios estén presentes
  for (const segment of segments) {
    if (!segment.roomId) {
      errors.push('Cada segmento debe tener una habitación asignada');
    }
    
    if (!segment.startDate || !segment.endDate) {
      errors.push('Cada segmento debe tener fechas de inicio y fin');
    }
    
    if (!segment.baseRate || segment.baseRate <= 0) {
      errors.push('Cada segmento debe tener una tarifa base válida');
    }
    
    if (!segment.guestCount || segment.guestCount <= 0) {
      errors.push('Cada segmento debe tener un número de huéspedes válido');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida la disponibilidad de habitaciones para un conjunto de segmentos
 */
async function validateRoomAvailability(segments, excludeReservationId = null) {
  const availabilityChecks = [];
  
  for (const segment of segments) {
    const hasOverlap = await hasSegmentOverlap(
      segment.roomId,
      segment.startDate,
      segment.endDate,
      excludeReservationId
    );
    
    availabilityChecks.push({
      roomId: segment.roomId,
      startDate: segment.startDate,
      endDate: segment.endDate,
      available: !hasOverlap
    });
  }
  
  const unavailableSegments = availabilityChecks.filter(check => !check.available);
  
  return {
    allAvailable: unavailableSegments.length === 0,
    unavailableSegments
  };
}

/**
 * Verifica que no haya días cerrados en el rango de fechas
 */
async function validateOperationalDays(segments) {
  // Por ahora, asumir que todos los días están abiertos
  // TODO: Implementar validación de períodos operacionales cuando esté disponible
  return {
    allDaysOpen: true,
    closedDays: []
  };
}

/**
 * Valida una reserva completa antes de crearla
 */
async function validateReservationCreation(reservationData) {
  const errors = [];
  
  // Validar campos obligatorios de la reserva
  if (!reservationData.mainClientId) {
    errors.push('Debe especificar un cliente principal');
  }
  
  if (!reservationData.segments || reservationData.segments.length === 0) {
    errors.push('La reserva debe tener al menos un segmento');
    return { isValid: false, errors };
  }
  
  // Validar segmentos
  const segmentValidation = await validateReservationSegments(reservationData.segments);
  if (!segmentValidation.isValid) {
    errors.push(...segmentValidation.errors);
  }
  
  // Validar disponibilidad
  const availabilityValidation = await validateRoomAvailability(reservationData.segments);
  if (!availabilityValidation.allAvailable) {
    errors.push('Algunas habitaciones no están disponibles en las fechas especificadas');
    availabilityValidation.unavailableSegments.forEach(segment => {
      errors.push(`Habitación ${segment.roomId}: ${segment.startDate} a ${segment.endDate}`);
    });
  }
  
  // Validar días operacionales
  const operationalValidation = await validateOperationalDays(reservationData.segments);
  if (!operationalValidation.allDaysOpen) {
    errors.push('No se pueden crear reservas en días cerrados');
    operationalValidation.closedDays.forEach(day => {
      errors.push(`Día cerrado: ${day.date.toLocaleDateString('es-ES')} en habitación ${day.segmentRoomId}`);
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida una actualización de reserva
 */
async function validateReservationUpdate(reservationId, updateData) {
  const errors = [];
  
  // Si se están actualizando segmentos, validarlos
  if (updateData.segments && Array.isArray(updateData.segments)) {
    const segmentValidation = await validateReservationSegments(updateData.segments, reservationId);
    if (!segmentValidation.isValid) {
      errors.push(...segmentValidation.errors);
    }
    
    const availabilityValidation = await validateRoomAvailability(updateData.segments, reservationId);
    if (!availabilityValidation.allAvailable) {
      errors.push('Algunas habitaciones no están disponibles en las fechas especificadas');
    }
    
    const operationalValidation = await validateOperationalDays(updateData.segments);
    if (!operationalValidation.allDaysOpen) {
      errors.push('No se pueden crear reservas en días cerrados');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  hasSegmentOverlap,
  areSegmentsConsecutive,
  validateReservationSegments,
  validateRoomAvailability,
  validateOperationalDays,
  validateReservationCreation,
  validateReservationUpdate
}; 