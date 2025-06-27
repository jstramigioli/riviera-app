import { format } from 'date-fns';

// Función para validar conflictos de reservas
export function validateReservationConflict(reservations, roomId, checkIn, checkOut, excludeReservationId = null) {
  const newCheckIn = new Date(checkIn);
  const newCheckOut = new Date(checkOut);
  
  // Buscar reservas existentes para la misma habitación
  const existingReservations = reservations.filter(res => 
    res.roomId === roomId && res.id !== excludeReservationId
  );
  
  // Verificar si hay conflictos
  for (const existingReservation of existingReservations) {
    const existingCheckIn = new Date(existingReservation.checkIn);
    const existingCheckOut = new Date(existingReservation.checkOut);
    
    // Verificar si hay solapamiento
    if (newCheckIn < existingCheckOut && newCheckOut > existingCheckIn) {
      return {
        hasConflict: true,
        conflictingReservation: existingReservation,
        message: `Conflicto con reserva existente: ${existingReservation.mainClient?.firstName} ${existingReservation.mainClient?.lastName} (${format(existingCheckIn, 'dd/MM/yyyy')} - ${format(existingCheckOut, 'dd/MM/yyyy')})`
      };
    }
  }
  
  return { hasConflict: false };
}

// Función para mostrar notificación de conflicto
export function showConflictNotification(message, position = null) {
  console.warn('Conflicto de reserva:', message);
  
  // Si no hay posición específica, usar alert como fallback
  if (!position) {
    alert(`⚠️ Conflicto de reserva: ${message}`);
    return;
  }
  
  // Retornar información para la notificación flotante
  return {
    message,
    type: 'error',
    position
  };
}

// Función para validar fechas de reserva
export function validateReservationDates(checkIn, checkOut) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  // Limpiar las horas para comparar solo fechas
  checkInDate.setHours(0, 0, 0, 0);
  checkOutDate.setHours(0, 0, 0, 0);
  
  if (checkOutDate <= checkInDate) {
    return {
      isValid: false,
      message: 'La fecha de check-out debe ser posterior a la fecha de check-in'
    };
  }
  
  return { isValid: true };
} 