import { getDisplaySegments } from './virtualRoomReservation';

const dateKey = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const formatShortDate = (value) => {
  const key = dateKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
  const [y, m, d] = key.split('-');
  return `${d}/${m}`;
};

/** Noches civiles entre YYYY-MM-DD (evita desfases por timezone). */
export const civilNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const start = dateKey(checkIn);
  const end = dateKey(checkOut);
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  if (![ys, ms, ds, ye, me, de].every(Number.isFinite)) return 0;
  const msDiff = Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds);
  return Math.max(0, Math.round(msDiff / 86400000));
};

/** Total de la estadía: nunca confundir con tarifa/noche (baseRate). */
export const resolveReservationTotal = (reservation, nights) => {
  const explicit = Number(reservation?.totalAmount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const activeSegments = (reservation?.segments || []).filter((s) => s.isActive !== false);
  const segments = activeSegments.length > 0 ? activeSegments : (reservation?.segments || []);
  if (segments.length > 0) {
    const fromSegments = segments.reduce((sum, segment) => {
      const segNights = civilNights(segment.startDate, segment.endDate) || nights || 1;
      const rate = Number(segment.baseRate) || 0;
      return sum + rate * segNights;
    }, 0);
    if (fromSegments > 0) return fromSegments;
  }

  const nightly = Number(reservation?.averageRate || reservation?.segments?.[0]?.baseRate) || 0;
  if (nightly > 0 && nights > 0) return nightly * nights;
  return 0;
};

const roomKey = (seg) => {
  if (!seg) return '';
  if (seg.virtualRoomId != null || seg.isVirtual) {
    return `virtual:${seg.virtualRoomId || seg.uiRoomId || ''}`;
  }
  return `room:${seg.roomId ?? seg.uiRoomId ?? ''}`;
};

const serviceKey = (seg) => {
  if (!seg) return '';
  if (Array.isArray(seg.services) && seg.services.length > 0) {
    return String(seg.services[0] || '');
  }
  return String(seg.serviceType || seg.reservationType || '');
};

const roomLabel = (seg) => {
  if (!seg) return '—';
  if (seg.uiRoomName) return String(seg.uiRoomName).replace(/^Hab(?:itación)?\s+/i, '');
  if (seg.room?.name) return String(seg.room.name);
  if (seg.virtualRoom?.name) return String(seg.virtualRoom.name);
  if (seg.roomId != null) return String(seg.roomId);
  return '—';
};

const serviceLabelFor = (seg, getServiceTypeLabel) => {
  const id = serviceKey(seg);
  if (!id) return 'Sin servicio';
  if (typeof getServiceTypeLabel === 'function') {
    const label = getServiceTypeLabel(id);
    if (label && label !== 'No especificado') return String(label);
  }
  return String(id);
};

const roomTypeLabel = (seg) => {
  if (!seg) return '—';
  const type =
    seg.roomType?.name ||
    seg.room?.roomType?.name ||
    seg.virtualRoom?.roomType?.name ||
    null;
  if (type) return String(type);
  return '—';
};

const edgeCard = (seg, getServiceTypeLabel, fallbackGuests) => {
  if (!seg) return null;
  const start = seg.startDate || seg.checkIn;
  const end = seg.endDate || seg.checkOut;
  const guests = Number(seg.guestCount) > 0
    ? Number(seg.guestCount)
    : (Number(fallbackGuests) > 0 ? Number(fallbackGuests) : 1);
  const nights = civilNights(start, end);
  return {
    room: roomLabel(seg),
    roomType: roomTypeLabel(seg),
    service: serviceLabelFor(seg, getServiceTypeLabel),
    guests,
    nights
  };
};

/** Etiqueta corta legacy (tests / compat): «habitación · servicio». */
const edgeLabel = (seg, getServiceTypeLabel) => {
  if (!seg) return null;
  const card = edgeCard(seg, getServiceTypeLabel);
  if (!card) return null;
  return `${card.room} · ${String(card.service).toLowerCase()}`;
};

const changeKind = (prev, next) => {
  const roomChanged = roomKey(prev) !== roomKey(next);
  const serviceChanged = serviceKey(prev) !== serviceKey(next);
  if (roomChanged && serviceChanged) return 'both';
  if (roomChanged) return 'room';
  if (serviceChanged) return 'service';
  return null;
};

const changeTitle = (kind) => {
  if (kind === 'room') return 'Cambio de habitación';
  if (kind === 'service') return 'Cambio de servicio';
  if (kind === 'both') return 'Cambio de habitación y servicio';
  return 'Cambio';
};

/**
 * Arma nodos + tramos del timeline de estadía para el detalle de reserva.
 * Nodos: check-in, cambios (multi-tramo), check-out.
 * Cards de tramo (habitación / tipo / servicio / huéspedes / noches) solo entre check-in y check-out.
 */
export function buildReservationStayTimeline(reservation, options = {}) {
  const getServiceTypeLabel = options.getServiceTypeLabel;
  const rawSegments = reservation?.segments || [];
  const segments = getDisplaySegments(rawSegments).slice().sort((a, b) => {
    const aStart = dateKey(a.startDate || a.checkIn);
    const bStart = dateKey(b.startDate || b.checkIn);
    return aStart.localeCompare(bStart);
  });

  const checkIn =
    reservation?.checkIn ||
    segments[0]?.startDate ||
    segments[0]?.checkIn ||
    null;
  const checkOut =
    reservation?.checkOut ||
    segments[segments.length - 1]?.endDate ||
    segments[segments.length - 1]?.checkOut ||
    null;

  const nightsFromDates = civilNights(checkIn, checkOut);
  const totalNights = Number(reservation?.days) > 0 ? Number(reservation.days) : nightsFromDates;
  const fallbackGuests = reservation?.requiredGuests || 1;
  const clientName = `${reservation?.mainClient?.firstName || ''} ${reservation?.mainClient?.lastName || ''}`.trim();
  const clientId = reservation?.mainClient?.id || null;
  const totalAmount = resolveReservationTotal(reservation, totalNights);

  const items = [];
  const firstSeg = segments[0] || null;

  items.push({
    type: 'node',
    id: 'checkin',
    kind: 'checkin',
    title: 'Check-in',
    date: checkIn,
    dateLabel: formatShortDate(checkIn)
  });

  if (segments.length <= 1) {
    items.push({
      type: 'edge',
      id: 'edge-stay',
      label: edgeLabel(firstSeg, getServiceTypeLabel),
      card: edgeCard(firstSeg, getServiceTypeLabel, fallbackGuests)
    });
  } else {
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      items.push({
        type: 'edge',
        id: `edge-seg-${i}`,
        label: edgeLabel(seg, getServiceTypeLabel),
        card: edgeCard(seg, getServiceTypeLabel, fallbackGuests)
      });

      if (i < segments.length - 1) {
        const next = segments[i + 1];
        const kind = changeKind(seg, next) || 'room';
        const at = next.startDate || next.checkIn || seg.endDate || seg.checkOut;
        items.push({
          type: 'node',
          id: `change-${i}`,
          kind: `change-${kind}`,
          title: changeTitle(kind),
          date: at,
          dateLabel: formatShortDate(at)
        });
      }
    }
  }

  items.push({
    type: 'node',
    id: 'checkout',
    kind: 'checkout',
    title: 'Check-out',
    date: checkOut,
    dateLabel: formatShortDate(checkOut)
  });

  return {
    items,
    segments,
    isMultiSegment: segments.length > 1,
    header: {
      clientName: clientName || '—',
      clientId,
      totalNights,
      totalAmount
    }
  };
}
