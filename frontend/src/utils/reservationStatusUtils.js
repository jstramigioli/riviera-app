// Utilidades para manejo de estados de reserva.
// La lista canónica vive en el backend (GET /api/reservations/statuses).
// Estos mapas son fallback / presentación local (colores, clases).

export const RESERVATION_STATUSES = {
  PENDIENTE: 'PENDIENTE',
  CONFIRMADA: 'CONFIRMADA',
  INGRESADA: 'INGRESADA',
  FINALIZADA: 'FINALIZADA',
  CANCELADA: 'CANCELADA',
  NO_PRESENTADA: 'NO_PRESENTADA',
};

/** Fallback si el API aún no respondió */
export const FALLBACK_STATUS_OPTIONS = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'CONFIRMADA', label: 'Confirmada' },
  { value: 'INGRESADA', label: 'Ingresada' },
  { value: 'FINALIZADA', label: 'Finalizada' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'NO_PRESENTADA', label: 'No presentada' },
];

export const getStatusLabel = (status, options = FALLBACK_STATUS_OPTIONS) => {
  const fromOptions = options.find((o) => o.value === status);
  if (fromOptions?.label) return fromOptions.label;

  const statusMap = {
    [RESERVATION_STATUSES.PENDIENTE]: 'Pendiente',
    [RESERVATION_STATUSES.CONFIRMADA]: 'Confirmada',
    [RESERVATION_STATUSES.INGRESADA]: 'Ingresada',
    [RESERVATION_STATUSES.FINALIZADA]: 'Finalizada',
    [RESERVATION_STATUSES.CANCELADA]: 'Cancelada',
    [RESERVATION_STATUSES.NO_PRESENTADA]: 'No presentada',
  };
  return statusMap[status] || status;
};

export const getStatusColor = (status) => {
  const colorMap = {
    [RESERVATION_STATUSES.PENDIENTE]: '#ffc107',
    [RESERVATION_STATUSES.CONFIRMADA]: '#17a2b8',
    [RESERVATION_STATUSES.INGRESADA]: '#28a745',
    [RESERVATION_STATUSES.FINALIZADA]: '#6c757d',
    [RESERVATION_STATUSES.CANCELADA]: '#dc3545',
    [RESERVATION_STATUSES.NO_PRESENTADA]: '#fd7e14',
  };
  return colorMap[status] || '#6c757d';
};

export const getStatusClass = (status) => {
  const classMap = {
    [RESERVATION_STATUSES.PENDIENTE]: 'status-pending',
    [RESERVATION_STATUSES.CONFIRMADA]: 'status-confirmed',
    [RESERVATION_STATUSES.INGRESADA]: 'status-checked-in',
    [RESERVATION_STATUSES.FINALIZADA]: 'status-finished',
    [RESERVATION_STATUSES.CANCELADA]: 'status-cancelled',
    [RESERVATION_STATUSES.NO_PRESENTADA]: 'status-no-show',
  };
  return classMap[status] || 'status-unknown';
};

export const isDangerStatus = (status) =>
  status === RESERVATION_STATUSES.CANCELADA ||
  status === RESERVATION_STATUSES.NO_PRESENTADA;
