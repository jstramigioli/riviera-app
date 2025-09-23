// Utilidades para manejo de estados de reserva

export const RESERVATION_STATUSES = {
  PENDIENTE: 'PENDIENTE',
  CONFIRMADA: 'CONFIRMADA',
  INGRESADA: 'INGRESADA',
  FINALIZADA: 'FINALIZADA',
  CANCELADA: 'CANCELADA',
  NO_PRESENTADA: 'NO_PRESENTADA'
};

export const getStatusLabel = (status) => {
  const statusMap = {
    [RESERVATION_STATUSES.PENDIENTE]: 'Pendiente',
    [RESERVATION_STATUSES.CONFIRMADA]: 'Confirmada',
    [RESERVATION_STATUSES.INGRESADA]: 'Ingresada',
    [RESERVATION_STATUSES.FINALIZADA]: 'Finalizada',
    [RESERVATION_STATUSES.CANCELADA]: 'Cancelada',
    [RESERVATION_STATUSES.NO_PRESENTADA]: 'No presentada'
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
    [RESERVATION_STATUSES.NO_PRESENTADA]: '#fd7e14'
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
    [RESERVATION_STATUSES.NO_PRESENTADA]: 'status-no-show'
  };
  return classMap[status] || 'status-unknown';
};
