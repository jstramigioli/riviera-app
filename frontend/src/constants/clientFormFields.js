/**
 * Campos / opciones del perfil de cliente.
 * Check-in público y EditClientModal deben usar los mismos valores.
 */
import { localDateInputToIso } from './billing';

export const CLIENT_DOCUMENT_TYPES = ['DNI', 'Pasaporte', 'Cédula', 'Otro'];

export const CLIENT_PROFILE_FIELD_KEYS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'documentType',
  'documentNumber',
  'documentIssuingCountry',
  'birthDate',
  'country',
  'province',
  'city',
  'address',
  'vehiclePlate',
  'wantsPromotions'
];

/** Países emisores frecuentes (mismo set que ubicación / facturación T). */
export const DOCUMENT_ISSUING_COUNTRIES = [
  { code: 'AR', name: 'Argentina' },
  { code: 'BR', name: 'Brasil' },
  { code: 'CL', name: 'Chile' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'PE', name: 'Perú' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'ES', name: 'España' },
  { code: 'IT', name: 'Italia' },
  { code: 'OTHER', name: 'Otro' }
];

/** Label y ayuda compartidos entre check-in y EditClientModal. */
export const VEHICLE_PLATE_LABEL = 'Patente (opcional)';
export const VEHICLE_PLATE_HINT = 'Para identificar el auto en el estacionamiento.';

export const BIRTH_DATE_LABEL = 'Fecha de nacimiento';
export const BIRTH_DATE_LABEL_OPTIONAL = 'Fecha de nacimiento (opcional)';
export const BIRTH_DATE_LABEL_REQUIRED = 'Fecha de nacimiento *';

/** ISO/Date → valor para input type="date" (YYYY-MM-DD). */
export function birthDateToInputValue(value) {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Display es-AR; vacío → null. */
export function formatBirthDateDisplay(value) {
  if (!value) return null;
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-AR');
  } catch {
    return null;
  }
}

/** YYYY-MM-DD vacío → null; válido → ISO mediodía local. */
export function birthDateInputToPayload(dateInputValue) {
  if (!dateInputValue) return null;
  return localDateInputToIso(dateInputValue);
}
