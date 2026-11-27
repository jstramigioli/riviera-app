/**
 * Estado agregado del check-in de huéspedes de una reserva.
 *
 * Regla (OnlineCheckIn + guests + envío del link):
 * - completo: hay ≥1 Guest y todos tienen OnlineCheckIn.status === 'COMPLETED'
 * - pendiente: hay envío del link (checkInTokenSentAt / OnlineCheckIn SENT|sentAt)
 *   o al menos un COMPLETED parcial, pero aún no están todos los guests completos
 * - no_enviado: sin envío y sin ningún COMPLETED
 *
 * Sin guests → no_enviado (salvo que el link ya se haya enviado → pendiente).
 */

export const GUEST_CHECKIN_STATUS = {
  COMPLETO: 'completo',
  PENDIENTE: 'pendiente',
  NO_ENVIADO: 'no_enviado'
};

export const GUEST_CHECKIN_LABELS = {
  [GUEST_CHECKIN_STATUS.COMPLETO]: 'Completo',
  [GUEST_CHECKIN_STATUS.PENDIENTE]: 'Pendiente',
  [GUEST_CHECKIN_STATUS.NO_ENVIADO]: 'No enviado'
};

function guestCheckInsForReservation(reservation) {
  const guests = Array.isArray(reservation?.guests) ? reservation.guests : [];
  const rows = Array.isArray(reservation?.onlineCheckIns)
    ? reservation.onlineCheckIns
    : [];
  const guestIds = new Set(
    guests.map((g) => Number(g?.id)).filter((id) => Number.isFinite(id))
  );
  if (guestIds.size === 0) return [];
  return rows.filter((row) => {
    const gid = Number(row?.guestId);
    return Number.isFinite(gid) && guestIds.has(gid);
  });
}

function wasCheckInSent(reservation, guestRows) {
  if (reservation?.checkInTokenSentAt) return true;
  return guestRows.some(
    (row) =>
      row?.status === 'SENT' ||
      row?.status === 'COMPLETED' ||
      Boolean(row?.sentAt)
  );
}

/**
 * @param {object|null|undefined} reservation
 * @returns {'completo'|'pendiente'|'no_enviado'}
 */
export function getReservationGuestCheckInStatus(reservation) {
  const guests = Array.isArray(reservation?.guests) ? reservation.guests : [];
  const guestRows = guestCheckInsForReservation(reservation);
  const completedCount = guestRows.filter((row) => row?.status === 'COMPLETED').length;
  const sent = wasCheckInSent(reservation, guestRows);

  if (guests.length > 0 && completedCount >= guests.length) {
    return GUEST_CHECKIN_STATUS.COMPLETO;
  }
  if (sent || completedCount > 0) {
    return GUEST_CHECKIN_STATUS.PENDIENTE;
  }
  return GUEST_CHECKIN_STATUS.NO_ENVIADO;
}

export function getReservationGuestCheckInLabel(reservationOrStatus) {
  const status =
    typeof reservationOrStatus === 'string'
      ? reservationOrStatus
      : getReservationGuestCheckInStatus(reservationOrStatus);
  return GUEST_CHECKIN_LABELS[status] || GUEST_CHECKIN_LABELS[GUEST_CHECKIN_STATUS.NO_ENVIADO];
}

export function isReservationGuestCheckInComplete(reservation) {
  return getReservationGuestCheckInStatus(reservation) === GUEST_CHECKIN_STATUS.COMPLETO;
}
