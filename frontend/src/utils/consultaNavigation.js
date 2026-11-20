/**
 * Navegación al flujo de consulta/edición de reserva.
 * El id debe ir en la URL (path o query) para que Consulta pueda
 * hidratar sin depender solo de location.state.
 */

export function buildConsultaEditPath(reservationId) {
  if (reservationId == null || reservationId === '') {
    throw new Error('reservationId is required to edit a reservation');
  }
  return `/consulta/${reservationId}`;
}

export function buildConsultaEditState(reservationId) {
  return {
    isEditingReservation: true,
    reservationId,
    reservationEdit: { id: reservationId }
  };
}

/**
 * Resuelve el id de reserva a editar desde path, query o state.
 * Prioridad: path param > query (reservaId|reservationId) > location.state.
 */
export function resolveEditReservationId({
  paramId = null,
  queryId = null,
  state = null
} = {}) {
  const fromState = state?.reservationId ?? state?.reservationEdit?.id ?? null;
  const raw = paramId ?? queryId ?? fromState ?? null;
  if (raw == null || raw === '') return null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && String(asNumber) === String(raw).trim()) {
    return asNumber;
  }
  return raw;
}

export function isConsultaEditIntent({
  paramId = null,
  queryId = null,
  state = null
} = {}) {
  return Boolean(
    paramId ||
    queryId ||
    state?.isEditingReservation ||
    state?.reservationEdit ||
    state?.reservationId
  );
}
