// Middleware para validar estados de reserva
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Estados válidos de reserva (deben coincidir con el enum en el esquema)
const VALID_RESERVATION_STATUSES = [
  'PENDIENTE',
  'CONFIRMADA', 
  'INGRESADA',
  'FINALIZADA',
  'CANCELADA',
  'NO_PRESENTADA'
];

/**
 * Valida que el estado de reserva sea válido
 */
const validateReservationStatus = (req, res, next) => {
  const { status } = req.body;
  
  // Si no se proporciona status, usar el valor por defecto
  if (!status) {
    req.body.status = 'PENDIENTE';
    return next();
  }
  
  // Verificar que el estado sea válido
  if (!VALID_RESERVATION_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'Estado de reserva inválido',
      message: `El estado '${status}' no es válido`,
      validStatuses: VALID_RESERVATION_STATUSES,
      receivedStatus: status
    });
  }
  
  next();
};

/**
 * Valida transiciones de estado (opcional - reglas de negocio)
 */
const validateStatusTransition = async (req, res, next) => {
  const { id } = req.params;
  const { status: newStatus } = req.body;
  
  // Si es una creación nueva, no hay transición que validar
  if (!id) {
    return next();
  }
  
  try {
    // Obtener el estado actual de la reserva
    const currentReservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
      select: { status: true }
    });
    
    if (!currentReservation) {
      return res.status(404).json({
        error: 'Reserva no encontrada'
      });
    }
    
    const currentStatus = currentReservation.status;
    
    // Definir transiciones válidas (reglas de negocio)
    const validTransitions = {
      'PENDIENTE': ['CONFIRMADA', 'CANCELADA'],
      'CONFIRMADA': ['INGRESADA', 'CANCELADA', 'NO_PRESENTADA'],
      'INGRESADA': ['FINALIZADA'],
      'FINALIZADA': ['INGRESADA'], // Reabrir estadía
      'CANCELADA': ['CONFIRMADA'], // Reactivar
      'NO_PRESENTADA': ['CONFIRMADA'] // Reactivar
    };
    
    // Si el estado no cambia, es válido
    if (currentStatus === newStatus) {
      return next();
    }
    
    // Verificar si la transición es válida
    const allowedTransitions = validTransitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(newStatus)) {
      return res.status(400).json({
        error: 'Transición de estado inválida',
        message: `No se puede cambiar de '${currentStatus}' a '${newStatus}'`,
        currentStatus,
        newStatus,
        allowedTransitions
      });
    }
    
    next();
  } catch (error) {
    console.error('Error validando transición de estado:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo validar la transición de estado'
    });
  }
};

/**
 * Middleware combinado que valida tanto el estado como la transición
 */
const validateReservationStatusMiddleware = [
  validateReservationStatus,
  validateStatusTransition
];

module.exports = {
  validateReservationStatus,
  validateStatusTransition,
  validateReservationStatusMiddleware,
  VALID_RESERVATION_STATUSES
};
