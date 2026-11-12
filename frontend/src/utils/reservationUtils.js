import { format } from 'date-fns';

// Función para validar conflictos de reservas
export function validateReservationConflict(reservations, roomId, checkIn, checkOut, excludeReservationId = null) {
  const newCheckIn = new Date(checkIn);
  const newCheckOut = new Date(checkOut);
  
  const nonOccupying = new Set(['CANCELADA', 'NO_PRESENTADA', 'cancelled', 'no_show']);
  // Buscar reservas existentes para la misma habitación (ignorar canceladas / no-show)
  const existingReservations = reservations.filter(res => 
    res.roomId === roomId &&
    res.id !== excludeReservationId &&
    !nonOccupying.has(res.status)
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

// Función para armar notificación de conflicto (sin alert del navegador).
// El caller debe mostrar el aviso in-app (useAppNotice / NotificationModal).
export function showConflictNotification(message, position = null) {
  console.warn('Conflicto de reserva:', message);

  return {
    message: `Conflicto de reserva: ${message}`,
    type: 'error',
    position: position || null
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