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
  if (!id) return 'sin servicio';
  if (typeof getServiceTypeLabel === 'function') {
    const label = getServiceTypeLabel(id);
    if (label && label !== 'No especificado') return String(label).toLowerCase();
  }
  return String(id).toLowerCase();
};

const edgeLabel = (seg, getServiceTypeLabel) => {
  if (!seg) return null;
  return `${roomLabel(seg)} · ${serviceLabelFor(seg, getServiceTypeLabel)}`;
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
 * Nodos: creación, check-in, cambios (multi-tramo), check-out.
 * Entre nodos: «nº habitación · tipo servicio».
 */
export function buildReservationStayTimeline(reservation, options = {}) {
  const getServiceTypeLabel = options.getServiceTypeLabel;
  const rawSegments = reservation?.segments || [];
  const segments = getDisplaySegments(rawSegments).slice().sort((a, b) => {
    const aStart = dateKey(a.startDate || a.checkIn);
    const bStart = dateKey(b.startDate || b.checkIn);
    return aStart.localeCompare(bStart);
  });

  const createdAt = reservation?.createdAt || null;
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

  const items = [];

  items.push({
    type: 'node',
    id: 'creation',
    kind: 'creation',
    title: 'Creación',
    date: createdAt,
    dateLabel: formatShortDate(createdAt)
  });

  const firstSeg = segments[0] || null;
  items.push({
    type: 'edge',
    id: 'edge-pre-checkin',
    label: edgeLabel(firstSeg, getServiceTypeLabel)
  });

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
      label: edgeLabel(firstSeg, getServiceTypeLabel)
    });
  } else {
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      items.push({
        type: 'edge',
        id: `edge-seg-${i}`,
        label: edgeLabel(seg, getServiceTypeLabel)
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
    isMultiSegment: segments.length > 1
  };
}
