/**
 * Campos / opciones del perfil de cliente.
 * Check-in público y EditClientModal deben usar los mismos valores.
 */
export const CLIENT_DOCUMENT_TYPES = ['DNI', 'Pasaporte', 'Cédula', 'Otro'];

export const CLIENT_PROFILE_FIELD_KEYS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'documentType',
  'documentNumber',
  'country',
  'province',
  'city',
  'address',
  'vehiclePlate',
  'wantsPromotions'
];

/** Label y ayuda compartidos entre check-in y EditClientModal. */
export const VEHICLE_PLATE_LABEL = 'Patente (opcional)';
export const VEHICLE_PLATE_HINT = 'Para identificar el auto en el estacionamiento.';
