// Middleware para validar estados de reserva (sin restricciones de transición)
const {
  VALID_RESERVATION_STATUSES,
  NON_OCCUPYING_STATUSES,
  OCCUPYING_STATUSES,
  DEFAULT_RESERVATION_STATUS,
  isValidReservationStatus,
} = require('../constants/reservationStatus');

/**
 * Valida que el estado de reserva sea un valor del enum canónico.
 * Cualquier estado válido es aceptado (incluye cambios "hacia atrás").
 */
const validateReservationStatus = (req, res, next) => {
  const { status } = req.body;

  // Si no se proporciona status, usar el valor por defecto
  if (!status) {
    req.body.status = DEFAULT_RESERVATION_STATUS;
    return next();
  }

  if (!isValidReservationStatus(status)) {
    return res.status(400).json({
      error: 'Estado de reserva inválido',
      message: `El estado '${status}' no es válido`,
      validStatuses: VALID_RESERVATION_STATUSES,
      receivedStatus: status,
    });
  }

  next();
};

/**
 * Antes restringía transiciones; ahora solo confirma que el destino es un estado válido.
 * Se mantiene el hook para no romper rutas que lo encadenan.
 */
const validateStatusTransition = (req, res, next) => {
  // Cualquier transición entre estados del enum está permitida.
  next();
};

/**
 * Middleware combinado que valida el estado (sin filtrar transiciones).
 */
const validateReservationStatusMiddleware = [
  validateReservationStatus,
  validateStatusTransition,
];

module.exports = {
  validateReservationStatus,
  validateStatusTransition,
  validateReservationStatusMiddleware,
  VALID_RESERVATION_STATUSES,
  NON_OCCUPYING_STATUSES,
  OCCUPYING_STATUSES,
};
