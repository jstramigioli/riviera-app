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
  const { name, capacity, price } = req.body;
  const errors = [];

  if (!name || name.trim().length === 0) {
    errors.push('El nombre de la habitación es requerido');
  }

  if (capacity && (isNaN(capacity) || capacity <= 0)) {
    errors.push('La capacidad debe ser un número positivo');
  }

  if (price !== undefined && (isNaN(price) || price <= 0)) {
    errors.push('El precio debe ser un número positivo');
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
  validateEmail
}; 