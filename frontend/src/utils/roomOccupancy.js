import { RESERVATION_STATUSES } from './reservationStatusUtils';

export const INACTIVE_ROOM_STATUSES = new Set([
  RESERVATION_STATUSES.CANCELADA,
  RESERVATION_STATUSES.FINALIZADA,
  RESERVATION_STATUSES.NO_PRESENTADA,
]);

export function reservationTouchesRoom(reservation, roomId) {
  const id = Number(roomId);
  return (reservation.segments || []).some((segment) => Number(segment.roomId) === id);
}

export function stayBoundsForRoom(reservation, roomId) {
  const id = Number(roomId);
  const segments = (reservation.segments || []).filter(
    (segment) => Number(segment.roomId) === id
  );
  if (!segments.length) {
    return { start: null, end: null };
  }
  let start = null;
  let end = null;
  for (const segment of segments) {
    const segStart = new Date(segment.startDate || segment.checkIn);
    const segEnd = new Date(segment.endDate || segment.checkOut);
    if (!Number.isNaN(segStart.getTime()) && (!start || segStart < start)) start = segStart;
    if (!Number.isNaN(segEnd.getTime()) && (!end || segEnd > end)) end = segEnd;
  }
  return { start, end };
}

export function occupancyLabel(roomId, reservations, now = new Date()) {
  const related = reservations.filter(
    (reservation) =>
      reservationTouchesRoom(reservation, roomId) &&
      !INACTIVE_ROOM_STATUSES.has(reservation.status)
  );

  const current = related.find((reservation) => {
    const { start, end } = stayBoundsForRoom(reservation, roomId);
    return start && end && now >= start && now < end;
  });
  if (current) return 'Ocupada';

  const upcoming = related
    .map((reservation) => ({ reservation, ...stayBoundsForRoom(reservation, roomId) }))
    .filter(({ start }) => start && start > now)
    .sort((a, b) => a.start - b.start);

  if (upcoming.length) {
    const days = Math.ceil((upcoming[0].start - now) / (1000 * 60 * 60 * 24));
    if (days <= 1) return 'Llega mañana';
    if (days <= 3) return `Llega en ${days} días`;
  }

  return 'Disponible';
}
