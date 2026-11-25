/**
 * Cómputo centralizado de comensales de comedor por fecha/servicio.
 *
 * Fuentes:
 * A. Media pensión — derivada de reservas de alojamiento + régimen (NO filas DiningReservation).
 * B. Adicionales alojados — DiningReservation con reservationId (huéspedes sin MP).
 * C. Externos — DiningReservation sin reservationId.
 *
 * Canceladas no computan. Sin doble conteo MP + adicional misma reserva/fecha.
 */

const { NON_OCCUPYING_STATUSES } = require('../constants/reservationStatus');
const { civilFromDb } = require('../utils/calendarDates');

const DINING_SERVICE = {
  CENA: 'CENA'
};

const DINING_STATUS = {
  CONFIRMADA: 'CONFIRMADA',
  CANCELADA: 'CANCELADA'
};

const SOURCE = {
  MEDIA_PENSION: 'media_pension',
  ADDITIONAL: 'additional',
  EXTERNAL: 'external'
};

function normalizeServiceToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildServiceTypesById(serviceTypes) {
  const map = new Map();
  for (const st of serviceTypes || []) {
    if (st?.id != null) map.set(String(st.id), st);
  }
  return map;
}

function primaryServiceRef(segs, reservation) {
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
 * Flags de comida según servicio canónico / nombre.
 * Misma semántica que frontend dayInfoStats.mealFlagsFromServiceRef.
 */
function mealFlagsFromServiceRef(ref, serviceTypesById = new Map()) {
  if (ref == null || ref === '') {
    return { breakfast: false, dinner: false };
  }

  const tokens = [String(ref)];
  const st = serviceTypesById.get(String(ref));
  if (st?.name) tokens.push(st.name);
  if (st?.description) tokens.push(st.description);
  if (st?.id) tokens.push(String(st.id));

  const blob = tokens.map(normalizeServiceToken).filter(Boolean).join(' ');
  if (!blob) return { breakfast: false, dinner: false };

  if (
    blob.includes('media_pension') ||
    blob.includes('half_board') ||
    blob === 'half' ||
    blob.includes('half')
  ) {
    return { breakfast: true, dinner: true };
  }

  if (
    blob.includes('solo_alojamiento') ||
    blob.includes('sin_desayuno') ||
    blob === 'lodging' ||
    blob === 'base' ||
    (blob.includes('alojamiento') &&
      !blob.includes('desayuno') &&
      !blob.includes('pension'))
  ) {
    return { breakfast: false, dinner: false };
  }

  if (
    blob.includes('desayuno') ||
    blob.includes('breakfast') ||
    blob.includes('con_desayuno')
  ) {
    return { breakfast: true, dinner: false };
  }

  return { breakfast: false, dinner: false };
}

function activeSegments(reservation) {
  const segments = reservation?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return [];
  return segments.filter((s) => s.isActive !== false);
}

function segmentsCoveringDay(segments, dayIso) {
  return segments.filter((seg) => {
    const start = civilFromDb(seg.startDate ?? seg.checkIn);
    const end = civilFromDb(seg.endDate ?? seg.checkOut);
    return start && end && start <= dayIso && dayIso < end;
  });
}

function reservationStayBounds(reservation, segments) {
  if (segments.length) {
    let start = null;
    let end = null;
    for (const seg of segments) {
      const s = civilFromDb(seg.startDate ?? seg.checkIn);
      const e = civilFromDb(seg.endDate ?? seg.checkOut);
      if (s && (!start || s < start)) start = s;
      if (e && (!end || e > end)) end = e;
    }
    return { start, end };
  }
  return {
    start: civilFromDb(reservation.checkIn),
    end: civilFromDb(reservation.checkOut)
  };
}

/**
 * Huéspedes de una reserva en una noche: colapsa componentes de la misma virtual.
 */
function guestsForCoveringSegments(reservation, covering) {
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

function clientDisplayName(client) {
  if (!client) return 'Sin nombre';
  const full = `${client.firstName || ''} ${client.lastName || ''}`.trim();
  if (full) return full;
  if (typeof client.name === 'string' && client.name.trim()) return client.name.trim();
  return 'Sin nombre';
}

function mainClientOf(reservation) {
  return reservation?.mainClient || null;
}

/**
 * ¿La reserva de alojamiento tiene cena por media pensión esa fecha?
 */
function lodgingHasMediaPensionDinner(reservation, dayIso, serviceTypesById) {
  if (!reservation) return false;
  if (NON_OCCUPYING_STATUSES.includes(reservation.status)) return false;

  const segments = activeSegments(reservation);
  const covering = segmentsCoveringDay(segments, dayIso);
  const { start, end } = reservationStayBounds(reservation, segments);

  let dinnerSegs = covering;
  if (!dinnerSegs.length) {
    if (!(start && end && start <= dayIso && dayIso < end)) return false;
    dinnerSegs = segments;
  } else if (!(start && end && start <= dayIso && dayIso < end) && !covering.length) {
    return false;
  }

  if (!(start && end && start <= dayIso && dayIso < end) && !covering.length) {
    return false;
  }

  const flags = mealFlagsFromServiceRef(
    primaryServiceRef(covering.length ? covering : dinnerSegs, reservation),
    serviceTypesById
  );
  return Boolean(flags.dinner);
}

/**
 * Comensales MP de una reserva de alojamiento para la fecha (0 si no aplica).
 */
function mediaPensionGuestCount(reservation, dayIso, serviceTypesById) {
  if (!lodgingHasMediaPensionDinner(reservation, dayIso, serviceTypesById)) {
    return 0;
  }
  const segments = activeSegments(reservation);
  const covering = segmentsCoveringDay(segments, dayIso);
  if (covering.length) {
    return guestsForCoveringSegments(reservation, covering);
  }
  return partySize(reservation, segments);
}

/**
 * @param {object} args
 * @param {string} args.dayIso yyyy-MM-dd
 * @param {'CENA'} [args.serviceType]
 * @param {object[]} args.lodgingReservations reservas de alojamiento (con segments, mainClient, guests)
 * @param {object[]} args.diningReservations filas DiningReservation (con client, reservation, account)
 * @param {object[]} [args.serviceTypes]
 * @returns {{
 *   date: string,
 *   serviceType: string,
 *   totals: { mediaPension: number, additional: number, external: number, total: number },
 *   mediaPension: object[],
 *   additional: object[],
 *   external: object[],
 *   cancelled: object[]
 * }}
 */
function computeDiningAgenda({
  dayIso,
  serviceType = DINING_SERVICE.CENA,
  lodgingReservations = [],
  diningReservations = [],
  serviceTypes = []
}) {
  const serviceTypesById = buildServiceTypesById(serviceTypes);
  const mediaPension = [];
  const additional = [];
  const external = [];
  const cancelled = [];
  const mpReservationIds = new Set();

  for (const reservation of lodgingReservations || []) {
    const guests = mediaPensionGuestCount(reservation, dayIso, serviceTypesById);
    if (guests <= 0) continue;
    mpReservationIds.add(reservation.id);
    const client = mainClientOf(reservation);
    mediaPension.push({
      source: SOURCE.MEDIA_PENSION,
      lodgingReservationId: reservation.id,
      lodgingReservationStatus: reservation.status || null,
      lodgingSource: reservation.source || null,
      clientId: client?.id ?? reservation.mainClientId ?? null,
      clientName: clientDisplayName(client),
      guestCount: guests,
      diningReservationId: null,
      accountId: reservation.account?.id ?? null,
      status: null,
      notes: null
    });
  }

  for (const row of diningReservations || []) {
    const rowService = row.serviceType || DINING_SERVICE.CENA;
    if (rowService !== serviceType) continue;

    const rowDate = civilFromDb(row.serviceDate);
    if (rowDate !== dayIso) continue;

    const entryBase = {
      diningReservationId: row.id,
      lodgingReservationId: row.reservationId ?? null,
      lodgingReservationStatus: row.reservation?.status || null,
      lodgingSource: row.reservation?.source || null,
      clientId: row.clientId ?? row.client?.id ?? null,
      clientName: clientDisplayName(row.client),
      guestCount: Math.max(0, Number(row.guestCount) || 0),
      accountId: row.accountId ?? row.account?.id ?? null,
      status: row.status,
      notes: row.notes || null,
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null
    };

    if (row.status === DINING_STATUS.CANCELADA) {
      cancelled.push({
        ...entryBase,
        source: row.reservationId ? SOURCE.ADDITIONAL : SOURCE.EXTERNAL
      });
      continue;
    }

    if (row.status !== DINING_STATUS.CONFIRMADA) continue;

    // Doble conteo: no sumar adicional si esa estadía ya aporta MP esa noche.
    if (row.reservationId != null && mpReservationIds.has(row.reservationId)) {
      continue;
    }

    if (row.reservationId != null) {
      additional.push({ ...entryBase, source: SOURCE.ADDITIONAL });
    } else {
      external.push({ ...entryBase, source: SOURCE.EXTERNAL });
    }
  }

  const sum = (list) => list.reduce((acc, item) => acc + (Number(item.guestCount) || 0), 0);
  const totals = {
    mediaPension: sum(mediaPension),
    additional: sum(additional),
    external: sum(external),
    total: 0
  };
  totals.total = totals.mediaPension + totals.additional + totals.external;

  return {
    date: dayIso,
    serviceType,
    totals,
    mediaPension,
    additional,
    external,
    cancelled
  };
}

/**
 * Detecta si crear/editar una reserva de comedor vinculada a alojamiento
 * chocaría con media pensión esa fecha.
 */
function wouldDoubleCountMediaPension({
  reservation,
  dayIso,
  serviceTypes = []
}) {
  if (!reservation) return false;
  const serviceTypesById = buildServiceTypesById(serviceTypes);
  return lodgingHasMediaPensionDinner(reservation, dayIso, serviceTypesById);
}

module.exports = {
  DINING_SERVICE,
  DINING_STATUS,
  SOURCE,
  mealFlagsFromServiceRef,
  lodgingHasMediaPensionDinner,
  mediaPensionGuestCount,
  computeDiningAgenda,
  wouldDoubleCountMediaPension,
  guestsForCoveringSegments,
  clientDisplayName
};
