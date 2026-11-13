/**
 * Estadísticas del panel de día del Libro.
 *
 * Convenciones (noche hotelera half-open: start <= day < end):
 * - Hab. ocupadas: habitaciones físicas distintas con segmento activo esa noche.
 * - Ocupación hab. % = occupiedRooms / totalRooms * 100
 * - Pasajeros alojados: por reserva (colapsando secundarios de virtual).
 * - Ocupación pasajeros % = totalGuests / Σ maxPeople * 100
 * - Ingresos/salidas (pasajeros): tamaño del grupo que llega/sale ese día civil.
 */

function civilOf(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  try {
    return value.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

const NON_OCCUPYING = new Set([
  'CANCELADA',
  'NO_PRESENTADA',
  'cancelled',
  'no_show'
]);

function roomCapacity(room) {
  const n = Number(room?.maxPeople ?? room?.roomType?.maxPeople);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function activeSegments(reservation) {
  const segments = reservation?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return [];
  return segments.filter((s) => s.isActive !== false);
}

function segmentsCoveringDay(segments, dayIso) {
  return segments.filter((seg) => {
    const start = civilOf(seg.startDate ?? seg.checkIn);
    const end = civilOf(seg.endDate ?? seg.checkOut);
    return start && end && start <= dayIso && dayIso < end;
  });
}

/**
 * Huéspedes de una reserva en una noche: colapsa componentes de la misma
 * virtual (el secundario suele traer guestCount=1).
 */
export function guestsForCoveringSegments(reservation, covering) {
  if (!covering?.length) return 0;

  const byVirtual = new Map();
  let physicalMax = 0;

  for (const seg of covering) {
    const virtualId =
      seg.virtualRoomId != null ? parseInt(seg.virtualRoomId, 10) : null;
    const count = Number(seg.guestCount);
    const n = Number.isFinite(count) && count > 0 ? count : 0;
    if (virtualId) {
      byVirtual.set(virtualId, Math.max(byVirtual.get(virtualId) || 0, n));
    } else {
      physicalMax = Math.max(physicalMax, n);
    }
  }

  let fromSegs = physicalMax;
  for (const n of byVirtual.values()) fromSegs += n;
  if (fromSegs <= 0) fromSegs = 1;

  const fromRequired = Number(reservation?.requiredGuests) || 0;
  const fromGuestsList = Array.isArray(reservation?.guests)
    ? reservation.guests.length
    : 0;

  return Math.max(fromSegs, fromRequired, fromGuestsList, 1);
}

function partySize(reservation, segments) {
  if (segments?.length) {
    return guestsForCoveringSegments(reservation, segments);
  }
  const fromRequired = Number(reservation?.requiredGuests) || 0;
  const fromGuestsList = Array.isArray(reservation?.guests)
    ? reservation.guests.length
    : 0;
  return Math.max(fromRequired, fromGuestsList, 1);
}

function reservationStayBounds(reservation, segments) {
  if (segments.length) {
    let start = null;
    let end = null;
    for (const seg of segments) {
      const s = civilOf(seg.startDate ?? seg.checkIn);
      const e = civilOf(seg.endDate ?? seg.checkOut);
      if (s && (!start || s < start)) start = s;
      if (e && (!end || e > end)) end = e;
    }
    return { start, end };
  }
  return {
    start: civilOf(reservation.checkIn),
    end: civilOf(reservation.checkOut)
  };
}

/** Nombre del cliente principal de una reserva (para listas del panel). */
export function mainClientDisplayName(reservation) {
  const c = reservation?.mainClient;
  if (!c) return 'Sin nombre';
  const full = `${c.firstName || ''} ${c.lastName || ''}`.trim();
  if (full) return full;
  if (typeof c.name === 'string' && c.name.trim()) return c.name.trim();
  return 'Sin nombre';
}

export function computeDayInfoStats(dayIso, rooms = [], reservations = []) {
  const totalRooms = rooms?.length || 0;
  const totalGuestCapacity = (rooms || []).reduce(
    (sum, room) => sum + roomCapacity(room),
    0
  );

  if (!dayIso) {
    return {
      checkIns: 0,
      checkOuts: 0,
      checkInNames: [],
      checkOutNames: [],
      occupiedRooms: 0,
      totalRooms,
      totalGuestCapacity,
      roomOccupancyPercentage: 0,
      totalGuests: 0,
      guestOccupancyPercentage: 0
    };
  }

  const occupiedRoomIds = new Set();
  let checkIns = 0;
  let checkOuts = 0;
  let totalGuests = 0;
  const checkInNames = [];
  const checkOutNames = [];

  for (const reservation of reservations || []) {
    if (NON_OCCUPYING.has(reservation.status)) continue;

    const segments = activeSegments(reservation);
    const covering = segmentsCoveringDay(segments, dayIso);
    const { start, end } = reservationStayBounds(reservation, segments);
    const size = partySize(reservation, covering.length ? covering : segments);

    if (segments.length) {
      for (const seg of covering) {
        if (seg.roomId != null) occupiedRoomIds.add(seg.roomId);
      }
      if (covering.length) {
        totalGuests += guestsForCoveringSegments(reservation, covering);
      }
    } else if (start && end && start <= dayIso && dayIso < end) {
      occupiedRoomIds.add(reservation.roomId || reservation.id);
      totalGuests += partySize(reservation, []);
    }

    if (start === dayIso) {
      checkIns += size;
      checkInNames.push(mainClientDisplayName(reservation));
    }
    if (end === dayIso) {
      checkOuts += size;
      checkOutNames.push(mainClientDisplayName(reservation));
    }
  }

  const occupiedRooms = occupiedRoomIds.size;
  const roomOccupancyPercentage =
    totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
  // Correcto: pasajeros / capacidad (Σ maxPeople). Antes se dividía por totalRooms.
  const guestOccupancyPercentage =
    totalGuestCapacity > 0 ? (totalGuests / totalGuestCapacity) * 100 : 0;

  return {
    checkIns,
    checkOuts,
    checkInNames,
    checkOutNames,
    occupiedRooms,
    totalRooms,
    totalGuestCapacity,
    roomOccupancyPercentage,
    totalGuests,
    guestOccupancyPercentage
  };
}
