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
  'wantsPromotions'
];

/** Solo check-in / reserva — no forzar al perfil Client. */
export const CHECKIN_ONLY_FIELD_KEYS = ['vehiclePlate'];
