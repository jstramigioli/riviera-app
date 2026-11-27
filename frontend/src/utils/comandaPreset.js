import { todayIsoLocal } from './calendarDates';

function civil(value) {
  if (!value) return null;
  return typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
}

/** Primera habitación con roomId de los tramos de la reserva. */
export function firstRoomIdFromReservation(reservation) {
  const segments = reservation?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const withRoom = segments.find((s) => s?.roomId != null && s?.isActive !== false) ||
    segments.find((s) => s?.roomId != null);
  return withRoom?.roomId ?? null;
}

/**
 * Preset para abrir «Nueva comanda» desde una reserva: la reserva ya elegida y una
 * fecha dentro de la estadía (hoy si está alojada; si no, el día de ingreso o de egreso),
 * porque el modal lista las reservas que ocupan habitación en esa fecha.
 */
export function comandaPresetForReservation(reservation, extra = {}) {
  if (!reservation?.id) return null;
  const active = (reservation.segments || []).filter((s) => s?.isActive !== false);
  const starts = active.map((s) => civil(s.startDate)).filter(Boolean).sort();
  const ends = active.map((s) => civil(s.endDate)).filter(Boolean).sort();
  const desde = starts[0] || civil(reservation.checkIn);
  const hasta = ends[ends.length - 1] || civil(reservation.checkOut);
  const hoy = todayIsoLocal();
  let fecha = hoy;
  if (desde && hoy < desde) fecha = desde;
  else if (hasta && hoy > hasta) fecha = hasta;
  return {
    reservationId: reservation.id,
    roomId: firstRoomIdFromReservation(reservation),
    fecha,
    ...extra
  };
}
