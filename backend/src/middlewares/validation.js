// Middleware de validación para datos de entrada
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateClient = (req, res, next) => {
  const { firstName, lastName, email, documentType, documentNumber } = req.body;
  const errors = [];

  if (!firstName || firstName.trim().length < 2) {
    errors.push('El nombre debe tener al menos 2 caracteres');
  }

  if (!lastName || lastName.trim().length < 2) {
    errors.push('El apellido debe tener al menos 2 caracteres');
  }

  if (email && !validateEmail(email)) {
    errors.push('El formato del email no es válido');
  }

  if (documentType && !['DNI', 'CÉDULA DE IDENTIDAD', 'CUIT', 'LIBRETA CÍVICA', 'LIBRETA DE ENROLAMENTO', 'LIBRETA DE EMBARQUE', 'PASAPORTE', 'OTRO'].includes(documentType)) {
    errors.push('Tipo de documento no válido');
  }

  if (documentNumber && documentNumber.trim().length < 3) {
    errors.push('El número de documento debe tener al menos 3 caracteres');
  }

  if (errors.length > 0) {
    const error = new Error('Error de validación');
    error.name = 'ValidationError';
    error.message = errors.join(', ');
    return next(error);
  }

  next();
};

const validateReservation = (req, res, next) => {
  const { checkIn, checkOut, totalAmount, roomId, mainClientId } = req.body;
  const isUpdate = req.method === 'PUT' || req.method === 'PATCH';
  const errors = [];

  if (!checkIn) {
    errors.push('La fecha de check-in es requerida');
  }

  if (!checkOut) {
    errors.push('La fecha de check-out es requerida');
  }

  if (checkIn && checkOut && new Date(checkIn) >= new Date(checkOut)) {
    errors.push('La fecha de check-out debe ser posterior al check-in');
  }

  if (totalAmount && (isNaN(totalAmount) || totalAmount <= 0)) {
    errors.push('El monto total debe ser un número positivo');
  }

  // roomId es requerido solo en creación, no en actualización
  if (!isUpdate && !roomId) {
    errors.push('El ID de la habitación es requerido');
  }

  // mainClientId es requerido solo en creación, no en actualización
  if (!isUpdate && !mainClientId) {
    errors.push('El ID del cliente principal es requerido');
  }

  if (errors.length > 0) {
    const error = new Error('Error de validación');
    error.name = 'ValidationError';
    error.message = errors.join(', ');
    return next(error);
  }

  next();
};

const validateRoom = (req, res, next) => {
  const { name, roomTypeId } = req.body;
  const errors = [];

  if (!name || name.trim().length === 0) {
    errors.push('El nombre de la habitación es requerido');
  }

  if (!roomTypeId) {
    errors.push('El tipo de habitación es requerido');
  }

  if (errors.length > 0) {
    const error = new Error('Error de validación');
    error.name = 'ValidationError';
    error.message = errors.join(', ');
    return next(error);
  }

  next();
};

const validateMultiSegmentReservation = (req, res, next) => {
  const { mainClientId, segments, status, notes, isMultiRoom } = req.body;
  const errors = [];

  // Validar cliente principal
  if (!mainClientId) {
    errors.push('El ID del cliente principal es requerido');
  }

  // Validar segmentos
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    errors.push('Debe especificar al menos un segmento de estancia');
  } else {
    segments.forEach((segment, index) => {
      if (!segment.roomId) {
        errors.push(`Segmento ${index + 1}: El ID de la habitación es requerido`);
      }
      if (!segment.startDate) {
        errors.push(`Segmento ${index + 1}: La fecha de inicio es requerida`);
      }
      if (!segment.endDate) {
        errors.push(`Segmento ${index + 1}: La fecha de fin es requerida`);
      }
      if (segment.startDate && segment.endDate && new Date(segment.startDate) >= new Date(segment.endDate)) {
        errors.push(`Segmento ${index + 1}: La fecha de fin debe ser posterior a la fecha de inicio`);
      }
      if (!segment.requiredGuests || segment.requiredGuests < 1) {
        errors.push(`Segmento ${index + 1}: El número de huéspedes debe ser al menos 1`);
      }
      // Validar services (array de IDs) en lugar de serviceType (singular)
      if (!segment.services || !Array.isArray(segment.services) || segment.services.length === 0) {
        errors.push(`Segmento ${index + 1}: Debe especificar al menos un tipo de servicio (services como array de IDs)`);
      }
      if (!segment.baseRate || segment.baseRate <= 0) {
        errors.push(`Segmento ${index + 1}: La tarifa base debe ser mayor a 0`);
      }
      if (!segment.guestCount || segment.guestCount < 1) {
        errors.push(`Segmento ${index + 1}: El número de huéspedes (guestCount) debe ser al menos 1`);
      }
    });
  }

  if (errors.length > 0) {
    const error = new Error('Error de validación');
    error.name = 'ValidationError';
    error.message = errors.join(', ');
    return next(error);
  }

  next();
};

module.exports = {
  validateClient,
  validateReservation,
  validateRoom,
  validateMultiSegmentReservation,
  validateEmail
}; 