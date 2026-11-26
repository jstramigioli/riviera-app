/**
 * Estadísticas del panel de día del Libro.
 *
 * Convenciones (noche hotelera half-open: start <= day < end):
 * - Hab. ocupadas: habitaciones físicas distintas con segmento activo esa noche.
 * - Ocupación hab. % = occupiedRooms / totalRooms * 100
 * - Pasajeros alojados: por reserva (colapsando secundarios de virtual).
 * - Ocupación pasajeros % = totalGuests / Σ maxPeople * 100
 * - Ingresos/salidas (pasajeros): tamaño del grupo que llega/sale ese día civil.
 * - Desayunos y cenas: los calcula el backend (PrestacionComida, GET /api/comidas);
 *   ver hooks/useComidasDelDia.js.
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

/** Ref de servicio de un segmento / reserva (ID, key o nombre). */
export function primaryServiceRef(segs, reservation) {
  for (const seg of segs || []) {
    if (Array.isArray(seg.services) && seg.services[0]) return seg.services[0];
    if (seg.serviceType) return seg.serviceType;
    if (seg.reservationType) return seg.reservationType;
  }
  return (
    reservation?.reservationType ||
    reservation?.serviceType ||
    (Array.isArray(reservation?.services) ? reservation.services[0] : null) ||
    null
  );
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

/** Nombre del responsable (titular) de una reserva (para listas del panel). */
export function mainClientDisplayName(reservation) {
  const c = reservation?.mainClient;
  if (!c) return 'Sin nombre';
  const full = `${c.firstName || ''} ${c.lastName || ''}`.trim();
  if (full) return full;
  if (typeof c.name === 'string' && c.name.trim()) return c.name.trim();
  return 'Sin nombre';
}

/** Id del titular de la reserva (para abrir perfil desde listas). */
export function mainClientIdOf(reservation) {
  const id = reservation?.mainClient?.id ?? reservation?.mainClientId;
  if (id == null || id === '') return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function buildRoomsById(rooms) {
  const map = new Map();
  for (const room of rooms || []) {
    if (room?.id != null) map.set(room.id, room);
  }
  return map;
}

function segmentRoomLabel(seg, roomsById) {
  if (!seg) return null;
  if (seg.uiRoomName) {
    return String(seg.uiRoomName).replace(/^Hab(?:itación)?\s+/i, '');
  }
  if (seg.room?.name) return String(seg.room.name);
  if (seg.virtualRoom?.name) return String(seg.virtualRoom.name);
  if (seg.roomId != null) {
    const fromList = roomsById.get(seg.roomId);
    if (fromList?.name) return String(fromList.name);
    return String(seg.roomId);
  }
  return null;
}

/**
 * Habitación(es) del movimiento: ingresos = segmentos que empiezan ese día;
 * salidas = segmentos que terminan ese día.
 */
export function movementRoomLabel(reservation, segments, dayIso, kind, roomsById) {
  const segs = Array.isArray(segments) ? segments : [];
  let relevant = [];
  if (kind === 'in') {
    relevant = segs.filter(
      (s) => civilOf(s.startDate ?? s.checkIn) === dayIso
    );
    if (!relevant.length) {
      relevant = segmentsCoveringDay(segs, dayIso);
    }
  } else {
    relevant = segs.filter(
      (s) => civilOf(s.endDate ?? s.checkOut) === dayIso
    );
  }

  const labels = [];
  const seen = new Set();
  for (const seg of relevant) {
    const label = segmentRoomLabel(seg, roomsById);
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }

  if (!labels.length) {
    const legacyId = reservation?.roomId;
    if (legacyId != null) {
      const fromList = roomsById.get(legacyId);
      if (fromList?.name) return String(fromList.name);
      return String(legacyId);
    }
    return '—';
  }

  return labels.join('/');
}

export function movementListLabel(roomLabel, guestName) {
  return `${roomLabel || '—'} - ${guestName || 'Sin nombre'}`;
}

function movementItem(reservation, segments, dayIso, kind, roomsById) {
  const guestName = mainClientDisplayName(reservation);
  const room = movementRoomLabel(
    reservation,
    segments,
    dayIso,
    kind,
    roomsById
  );
  return {
    reservationId: reservation.id,
    roomLabel: room,
    guestName,
    label: movementListLabel(room, guestName)
  };
}

export function computeDayInfoStats(dayIso, rooms = [], reservations = []) {
  const totalRooms = rooms?.length || 0;
  const totalGuestCapacity = (rooms || []).reduce(
    (sum, room) => sum + roomCapacity(room),
    0
  );
  const roomsById = buildRoomsById(rooms);

  if (!dayIso) {
    return {
      checkIns: 0,
      checkOuts: 0,
      checkInNames: [],
      checkOutNames: [],
      checkInItems: [],
      checkOutItems: [],
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
  const checkInItems = [];
  const checkOutItems = [];
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
      checkInItems.push(
        movementItem(reservation, segments, dayIso, 'in', roomsById)
      );
    }
    if (end === dayIso) {
      checkOuts += size;
      checkOutItems.push(
        movementItem(reservation, segments, dayIso, 'out', roomsById)
      );
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
    checkInNames: checkInItems.map((i) => i.label),
    checkOutNames: checkOutItems.map((i) => i.label),
    checkInItems,
    checkOutItems,
    occupiedRooms,
    totalRooms,
    totalGuestCapacity,
    roomOccupancyPercentage,
    totalGuests,
    guestOccupancyPercentage
  };
}
