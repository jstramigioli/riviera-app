const prisma = require('./prisma');
const { toDateOnlyUtc, civilFromDb, shiftIso, isoDate } = require('./calendarDates');
const { OCCUPYING_STATUSES } = require('../middlewares/reservationStatusValidation');

const ROOM_STATUS = {
  AVAILABLE: 'available',
  MAINTENANCE: 'maintenance',
  UNAVAILABLE: 'unavailable'
};

const BLOCKING_STATUSES = new Set([
  ROOM_STATUS.MAINTENANCE,
  ROOM_STATUS.UNAVAILABLE
]);

const STATUS_LABELS = {
  [ROOM_STATUS.AVAILABLE]: 'Disponible',
  [ROOM_STATUS.MAINTENANCE]: 'Mantenimiento',
  [ROOM_STATUS.UNAVAILABLE]: 'No disponible'
};

function normalizeStatus(raw) {
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase();
  if (value === 'disponible') return ROOM_STATUS.AVAILABLE;
  if (value === 'mantenimiento') return ROOM_STATUS.MAINTENANCE;
  if (value === 'no_disponible' || value === 'no-disponible' || value === 'nodisponible') {
    return ROOM_STATUS.UNAVAILABLE;
  }
  if (Object.values(ROOM_STATUS).includes(value)) return value;
  return null;
}

function statusLabel(status) {
  return STATUS_LABELS[normalizeStatus(status)] || status || '—';
}

function parseExclusiveRange(startInput, endInput) {
  if (!startInput || !endInput) {
    return { error: 'startDate y endDate son obligatorios (YYYY-MM-DD)' };
  }
  const startIso = String(startInput).slice(0, 10);
  const endIso = String(endInput).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
    return { error: 'Fechas inválidas; usar YYYY-MM-DD' };
  }
  if (startIso >= endIso) {
    return { error: 'startDate debe ser anterior a endDate (fin exclusivo)' };
  }
  return {
    startIso,
    endIso,
    startDate: toDateOnlyUtc(startIso),
    endDate: toDateOnlyUtc(endIso)
  };
}

/** Inclusive UI range → exclusive end for storage. */
function parseInclusiveRange(startInput, endInclusiveInput) {
  if (!startInput || !endInclusiveInput) {
    return { error: 'desde y hasta son obligatorios (YYYY-MM-DD)' };
  }
  const startIso = String(startInput).slice(0, 10);
  const endInclusiveIso = String(endInclusiveInput).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endInclusiveIso)) {
    return { error: 'Fechas inválidas; usar YYYY-MM-DD' };
  }
  if (startIso > endInclusiveIso) {
    return { error: 'La fecha desde no puede ser posterior a hasta' };
  }
  const endIso = shiftIso(endInclusiveIso, 1);
  return {
    startIso,
    endIso,
    endInclusiveIso,
    startDate: toDateOnlyUtc(startIso),
    endDate: toDateOnlyUtc(endIso)
  };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function findOccupyingReservations(roomId, startDate, endDate) {
  return prisma.reservationSegment.findMany({
    where: {
      roomId: Number(roomId),
      isActive: true,
      startDate: { lt: endDate },
      endDate: { gt: startDate },
      reservation: {
        status: { in: OCCUPYING_STATUSES }
      }
    },
    include: {
      reservation: {
        select: {
          id: true,
          status: true,
          mainClient: { select: { firstName: true, lastName: true } }
        }
      }
    },
    orderBy: { startDate: 'asc' }
  });
}

async function findOverlappingPeriods(roomId, startDate, endDate, tx = prisma) {
  return tx.roomStatusPeriod.findMany({
    where: {
      roomId: Number(roomId),
      startDate: { lt: endDate },
      endDate: { gt: startDate }
    },
    orderBy: { startDate: 'asc' }
  });
}

/**
 * Quita / recorta períodos que solapan [startDate, endDate) e inserta uno nuevo
 * si status es blocking. available solo limpia.
 */
async function applyStatusRange({ roomId, startDate, endDate, status, note }) {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    const err = new Error('Estado inválido. Usar: available, maintenance, unavailable');
    err.statusCode = 400;
    throw err;
  }

  if (BLOCKING_STATUSES.has(normalized)) {
    const conflicts = await findOccupyingReservations(roomId, startDate, endDate);
    if (conflicts.length > 0) {
      const err = new Error(
        'No se puede cambiar el estado: hay reservas en ese rango de fechas'
      );
      err.statusCode = 409;
      err.code = 'RESERVATIONS_IN_RANGE';
      err.conflicts = conflicts.map((seg) => ({
        reservationId: seg.reservationId,
        status: seg.reservation?.status,
        startDate: civilFromDb(seg.startDate),
        endDate: civilFromDb(seg.endDate),
        guest: seg.reservation?.mainClient
          ? `${seg.reservation.mainClient.firstName || ''} ${seg.reservation.mainClient.lastName || ''}`.trim()
          : null
      }));
      throw err;
    }
  }

  return prisma.$transaction(async (tx) => {
    const overlapping = await findOverlappingPeriods(roomId, startDate, endDate, tx);

    for (const period of overlapping) {
      const pStart = period.startDate;
      const pEnd = period.endDate;

      // Completamente dentro → borrar
      if (pStart >= startDate && pEnd <= endDate) {
        await tx.roomStatusPeriod.delete({ where: { id: period.id } });
        continue;
      }

      // El existente envuelve el rango → partir en izquierda + derecha
      if (pStart < startDate && pEnd > endDate) {
        await tx.roomStatusPeriod.update({
          where: { id: period.id },
          data: { endDate: startDate }
        });
        await tx.roomStatusPeriod.create({
          data: {
            roomId: Number(roomId),
            startDate: endDate,
            endDate: pEnd,
            status: period.status,
            note: period.note
          }
        });
        continue;
      }

      // Solapa por la izquierda → recortar fin
      if (pStart < startDate && pEnd > startDate) {
        await tx.roomStatusPeriod.update({
          where: { id: period.id },
          data: { endDate: startDate }
        });
        continue;
      }

      // Solapa por la derecha → recortar inicio
      if (pStart < endDate && pEnd > endDate) {
        await tx.roomStatusPeriod.update({
          where: { id: period.id },
          data: { startDate: endDate }
        });
      }
    }

    if (!BLOCKING_STATUSES.has(normalized)) {
      return {
        status: ROOM_STATUS.AVAILABLE,
        cleared: true,
        period: null
      };
    }

    const period = await tx.roomStatusPeriod.create({
      data: {
        roomId: Number(roomId),
        startDate,
        endDate,
        status: normalized,
        note: note ? String(note).trim() || null : null
      }
    });

    return {
      status: normalized,
      cleared: false,
      period
    };
  });
}

async function listStatusPeriods(roomId, { from, to } = {}) {
  const where = { roomId: Number(roomId) };
  if (from || to) {
    const start = from ? toDateOnlyUtc(from) : toDateOnlyUtc('1970-01-01');
    const end = to ? toDateOnlyUtc(to) : toDateOnlyUtc('2100-01-01');
    where.startDate = { lt: end };
    where.endDate = { gt: start };
  }
  return prisma.roomStatusPeriod.findMany({
    where,
    orderBy: { startDate: 'asc' }
  });
}

async function deleteStatusPeriod(roomId, periodId) {
  const existing = await prisma.roomStatusPeriod.findFirst({
    where: { id: Number(periodId), roomId: Number(roomId) }
  });
  if (!existing) return null;
  await prisma.roomStatusPeriod.delete({ where: { id: existing.id } });
  return existing;
}

/**
 * IDs de habitaciones con maintenance/unavailable que solapan [start, end).
 */
async function findBlockedRoomIds(startInput, endInput, roomIds = null) {
  const startDate = toDateOnlyUtc(startInput);
  const endDate = toDateOnlyUtc(endInput);
  const where = {
    status: { in: [...BLOCKING_STATUSES] },
    startDate: { lt: endDate },
    endDate: { gt: startDate }
  };
  if (roomIds && roomIds.length) {
    where.roomId = { in: roomIds.map(Number) };
  }
  const rows = await prisma.roomStatusPeriod.findMany({
    where,
    select: { roomId: true },
    distinct: ['roomId']
  });
  return rows.map((r) => r.roomId);
}

async function roomHasBlockingStatus(roomId, startInput, endInput) {
  const startDate = toDateOnlyUtc(startInput);
  const endDate = toDateOnlyUtc(endInput);
  const hit = await prisma.roomStatusPeriod.findFirst({
    where: {
      roomId: Number(roomId),
      status: { in: [...BLOCKING_STATUSES] },
      startDate: { lt: endDate },
      endDate: { gt: startDate }
    },
    select: { id: true, status: true, startDate: true, endDate: true }
  });
  return hit;
}

async function loadStatusPeriodsForWindow(startIso, endExclusiveIso) {
  const startDate = toDateOnlyUtc(startIso);
  const endDate = toDateOnlyUtc(endExclusiveIso);
  return prisma.roomStatusPeriod.findMany({
    where: {
      status: { in: [...BLOCKING_STATUSES] },
      startDate: { lt: endDate },
      endDate: { gt: startDate }
    },
    orderBy: { startDate: 'asc' }
  });
}

function serializePeriod(period) {
  if (!period) return null;
  return {
    id: period.id,
    roomId: period.roomId,
    status: period.status,
    label: statusLabel(period.status),
    startDate: civilFromDb(period.startDate),
    endDate: civilFromDb(period.endDate),
    endInclusive: period.endDate
      ? shiftIso(civilFromDb(period.endDate), -1)
      : null,
    note: period.note || null,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt
  };
}

module.exports = {
  ROOM_STATUS,
  BLOCKING_STATUSES,
  STATUS_LABELS,
  normalizeStatus,
  statusLabel,
  parseExclusiveRange,
  parseInclusiveRange,
  rangesOverlap,
  findOccupyingReservations,
  findOverlappingPeriods,
  applyStatusRange,
  listStatusPeriods,
  deleteStatusPeriod,
  findBlockedRoomIds,
  roomHasBlockingStatus,
  loadStatusPeriodsForWindow,
  serializePeriod,
  toDateOnlyUtc,
  isoDate,
  shiftIso,
  civilFromDb
};
