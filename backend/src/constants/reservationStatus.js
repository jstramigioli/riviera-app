/**
 * Fuente canónica de estados de reserva.
 * Debe coincidir con el enum ReservationStatus en prisma/schema.prisma.
 * Preferimos Prisma Client cuando está generado; el array es el fallback/documentación.
 */
let prismaStatuses = null;
try {
  // eslint-disable-next-line global-require
  const { ReservationStatus } = require('@prisma/client');
  if (ReservationStatus && typeof ReservationStatus === 'object') {
    prismaStatuses = Object.values(ReservationStatus);
  }
} catch (_) {
  prismaStatuses = null;
}

const FALLBACK_STATUSES = [
  'PENDIENTE',
  'CONFIRMADA',
  'INGRESADA',
  'FINALIZADA',
  'CANCELADA',
  'NO_PRESENTADA',
];

const VALID_RESERVATION_STATUSES = prismaStatuses?.length
  ? prismaStatuses
  : FALLBACK_STATUSES;

/** Etiquetas UI (español) asociadas al enum canónico del backend */
const RESERVATION_STATUS_LABELS = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  INGRESADA: 'Ingresada',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
  NO_PRESENTADA: 'No presentada',
};

/** Estados que no ocupan habitación ni deben verse en el Libro */
const NON_OCCUPYING_STATUSES = ['CANCELADA', 'NO_PRESENTADA'];

/** Estados que sí ocupan (calendario, overlap, disponibilidad) */
const OCCUPYING_STATUSES = VALID_RESERVATION_STATUSES.filter(
  (s) => !NON_OCCUPYING_STATUSES.includes(s)
);

const DEFAULT_RESERVATION_STATUS = 'PENDIENTE';

/**
 * Lista lista para el frontend: value + label.
 * Cualquier estado del enum es seleccionable (sin filtro de transición).
 */
function getReservationStatusOptions() {
  return VALID_RESERVATION_STATUSES.map((value) => ({
    value,
    label: RESERVATION_STATUS_LABELS[value] || value,
    occupiesRoom: !NON_OCCUPYING_STATUSES.includes(value),
  }));
}

function isValidReservationStatus(status) {
  return VALID_RESERVATION_STATUSES.includes(status);
}

module.exports = {
  VALID_RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
  NON_OCCUPYING_STATUSES,
  OCCUPYING_STATUSES,
  DEFAULT_RESERVATION_STATUS,
  getReservationStatusOptions,
  isValidReservationStatus,
};
