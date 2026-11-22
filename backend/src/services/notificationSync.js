const prisma = require('../utils/prisma');
const { ROLES } = require('../auth/roles');

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

function personName(person) {
  if (!person) return 'Sin nombre';
  const full = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return full || 'Sin nombre';
}

/** MM-DD civil (UTC / ISO date-only) para comparar cumpleaños. */
function monthDayOf(value) {
  const iso = civilOf(value);
  if (!iso || iso.length < 10) return null;
  return iso.slice(5, 10);
}

function isBirthdayToday(birthDate, todayIso) {
  const md = monthDayOf(birthDate);
  const todayMd = monthDayOf(todayIso);
  return Boolean(md && todayMd && md === todayMd);
}

/**
 * Habitación vigente hoy: segmento activo que cubre todayIso (start inclusive, end exclusive).
 * Si no hay match, cae al primer segmento activo con room.
 */
function roomLabelForToday(reservation, todayIso) {
  const segments = activeSegments(reservation);
  const covering = segments.find((seg) => {
    const s = civilOf(seg.startDate);
    const e = civilOf(seg.endDate);
    if (!s || !e) return false;
    return s <= todayIso && todayIso < e;
  });
  const seg =
    covering ||
    segments.find((s) => s.room?.name) ||
    segments[0] ||
    null;
  const name = seg?.room?.name || seg?.virtualRoom?.name;
  return name ? String(name) : null;
}

const PRE_CHECKIN = new Set(['PENDIENTE', 'CONFIRMADA']);

/** Roles que reciben aviso de cumpleaños de huésped alojado. */
const BIRTHDAY_AUDIENCE_ROLES = [
  ROLES.ADMIN,
  ROLES.PROPIETARIO,
  ROLES.RECEPCION,
  ROLES.CAMARERO
];

/**
 * Genera payloads SYSTEM a partir del estado operativo del día.
 * (PENDING_ARRIVAL / LATE_CHECKOUT se mantienen en el builder pero el sync
 * diario solo materializa GUEST_BIRTHDAY — el resto quedó pausado a propósito.)
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
 * Personas con cumpleaños hoy en reservas INGRESADA (en casa).
 * Incluye titular (mainClient) y huéspedes vinculados a Client con birthDate.
 */
function collectBirthdayPeople(reservation, todayIso) {
  const people = [];
  const seenClientIds = new Set();

  const main = reservation?.mainClient;
  if (main?.id != null && isBirthdayToday(main.birthDate, todayIso)) {
    seenClientIds.add(main.id);
    people.push({
      clientId: main.id,
      name: personName(main),
      isMainClient: true
    });
  }

  for (const guest of reservation?.guests || []) {
    const linked = guest?.client;
    if (!linked?.id || seenClientIds.has(linked.id)) continue;
    if (!isBirthdayToday(linked.birthDate, todayIso)) continue;
    seenClientIds.add(linked.id);
    people.push({
      clientId: linked.id,
      name: personName(linked),
      isMainClient: false
    });
  }

  return people;
}

/**
 * Payloads GUEST_BIRTHDAY: una notificación por rol destinatario.
 */
function buildBirthdayPayloads(todayIso, reservations = []) {
  const payloads = [];

  for (const reservation of reservations || []) {
    if (reservation?.status !== 'INGRESADA') continue;

    const { start, end } = stayBounds(reservation);
    // En casa hoy: ya ingresó y aún no pasó el checkout previsto (o sin fin).
    if (start && start > todayIso) continue;
    if (end && todayIso > end) continue;

    const room = roomLabelForToday(reservation, todayIso);
    const people = collectBirthdayPeople(reservation, todayIso);

    for (const person of people) {
      const roomPart = room ? ` · hab. ${room}` : '';
      const reservePart = ` · reserva #${reservation.id}`;
      const body = `${person.name} cumple años hoy${roomPart}${reservePart}`;

      for (const role of BIRTHDAY_AUDIENCE_ROLES) {
        payloads.push({
          type: 'GUEST_BIRTHDAY',
          severity: 'INFO',
          title: 'Cumpleaños de huésped',
          body,
          linkType: 'RESERVATION',
          linkId: String(reservation.id),
          dedupeKey: `GUEST_BIRTHDAY:${todayIso}:${person.clientId}:${reservation.id}:${role}`,
          audienceRole: role,
          source: 'SYSTEM',
          meta: {
            date: todayIso,
            clientId: person.clientId,
            reservationId: reservation.id,
            roomName: room,
            guestName: person.name,
            isMainClient: person.isMainClient
          }
        });
      }
    }
  }

  return payloads;
}

/**
 * Upsert GUEST_BIRTHDAY del día + auto-resuelve las SYSTEM de cumpleaños
 * cuya condición ya no aplica. No reactiva PENDING_ARRIVAL / LATE_CHECKOUT.
 */
async function syncOperationalNotifications(todayIso) {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: 'INGRESADA'
    },
    include: {
      mainClient: true,
      guests: { include: { client: true } },
      segments: {
        include: {
          room: true,
          virtualRoom: true
        }
      }
    }
  });

  const payloads = buildBirthdayPayloads(String(todayIso), reservations);
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
        resolvedAt: null,
        resolvedById: null
      }
    });
    upserted += 1;
  }

  const stale = await prisma.appNotification.findMany({
    where: {
      source: 'SYSTEM',
      type: 'GUEST_BIRTHDAY',
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

  return {
    upserted,
    autoResolved,
    active: payloads.length,
    type: 'GUEST_BIRTHDAY'
  };
}

module.exports = {
  buildOperationalPayloads,
  buildBirthdayPayloads,
  collectBirthdayPeople,
  isBirthdayToday,
  monthDayOf,
  roomLabelForToday,
  BIRTHDAY_AUDIENCE_ROLES,
  syncOperationalNotifications
};
