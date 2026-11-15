const prisma = require('../utils/prisma');

function civilOf(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  try {
    return value.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function activeSegments(reservation) {
  const segments = reservation?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return [];
  return segments.filter((s) => s.isActive !== false);
}

function stayBounds(reservation) {
  const segments = activeSegments(reservation);
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
    start: civilOf(reservation?.checkIn),
    end: civilOf(reservation?.checkOut)
  };
}

function clientName(reservation) {
  const c = reservation?.mainClient;
  if (!c) return 'Sin nombre';
  const full = `${c.firstName || ''} ${c.lastName || ''}`.trim();
  if (full) return full;
  if (typeof c.name === 'string' && c.name.trim()) return c.name.trim();
  return 'Sin nombre';
}

const PRE_CHECKIN = new Set(['PENDIENTE', 'CONFIRMADA']);

/**
 * Genera payloads SYSTEM a partir del estado operativo del día.
 */
function buildOperationalPayloads(todayIso, reservations = []) {
  const payloads = [];

  for (const reservation of reservations || []) {
    if (
      reservation?.status === 'CANCELADA' ||
      reservation?.status === 'NO_PRESENTADA' ||
      reservation?.status === 'FINALIZADA'
    ) {
      continue;
    }

    const { start, end } = stayBounds(reservation);
    const name = clientName(reservation);

    if (
      start &&
      ((start === todayIso && PRE_CHECKIN.has(reservation.status)) ||
        (start < todayIso && PRE_CHECKIN.has(reservation.status)))
    ) {
      const overdue = start < todayIso;
      payloads.push({
        type: 'PENDING_ARRIVAL',
        severity: overdue ? 'WARNING' : 'INFO',
        title: overdue ? 'Ingreso atrasado' : 'Ingreso pendiente',
        body: overdue
          ? `${name} · check-in previsto ${start}`
          : `${name} · check-in hoy`,
        linkType: 'RESERVATION',
        linkId: String(reservation.id),
        dedupeKey: `PENDING_ARRIVAL:${reservation.id}`,
        audienceRole: null,
        source: 'SYSTEM',
        meta: { plannedCheckIn: start, overdue }
      });
    }

    if (reservation?.status === 'INGRESADA' && end && end < todayIso) {
      payloads.push({
        type: 'LATE_CHECKOUT',
        severity: 'WARNING',
        title: 'Checkout atrasado',
        body: `${name} · check-out previsto ${end}`,
        linkType: 'RESERVATION',
        linkId: String(reservation.id),
        dedupeKey: `LATE_CHECKOUT:${reservation.id}`,
        audienceRole: null,
        source: 'SYSTEM',
        meta: { plannedCheckout: end }
      });
    }
  }

  return payloads;
}

/**
 * Upsert operativas + auto-resuelve SYSTEM cuya condición ya no aplica.
 */
async function syncOperationalNotifications(todayIso) {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: {
        notIn: ['CANCELADA', 'NO_PRESENTADA']
      }
    },
    include: {
      mainClient: true,
      segments: true
    }
  });

  const payloads = buildOperationalPayloads(todayIso, reservations);
  const activeKeys = new Set(payloads.map((p) => p.dedupeKey));

  let upserted = 0;
  for (const payload of payloads) {
    await prisma.appNotification.upsert({
      where: { dedupeKey: payload.dedupeKey },
      create: {
        ...payload,
        resolvedAt: null,
        resolvedById: null
      },
      update: {
        severity: payload.severity,
        title: payload.title,
        body: payload.body,
        linkType: payload.linkType,
        linkId: payload.linkId,
        audienceRole: payload.audienceRole,
        meta: payload.meta,
        // Si la condición vuelve, reabrir.
        resolvedAt: null,
        resolvedById: null
      }
    });
    upserted += 1;
  }

  const stale = await prisma.appNotification.findMany({
    where: {
      source: 'SYSTEM',
      type: { in: ['PENDING_ARRIVAL', 'LATE_CHECKOUT'] },
      resolvedAt: null,
      dedupeKey: { not: null }
    },
    select: { id: true, dedupeKey: true }
  });

  const toResolve = stale
    .filter((n) => n.dedupeKey && !activeKeys.has(n.dedupeKey))
    .map((n) => n.id);

  let autoResolved = 0;
  if (toResolve.length) {
    const result = await prisma.appNotification.updateMany({
      where: { id: { in: toResolve } },
      data: {
        resolvedAt: new Date(),
        resolvedById: null
      }
    });
    autoResolved = result.count;
  }

  return { upserted, autoResolved, active: payloads.length };
}

module.exports = {
  buildOperationalPayloads,
  syncOperationalNotifications
};
