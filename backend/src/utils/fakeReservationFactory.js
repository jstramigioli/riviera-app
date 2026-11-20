const { randomUUID } = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('./prisma');
const { createReservationWithSegments } = require('./reservationHelpers');
const {
  ensureReservationAccount,
  dualWriteReservationRefs,
  syncAccountStatusFromBalance
} = require('./accountHelpers');
const { allocateNextPagoCodigo } = require('./pagoCodigo');

const DEBUG_NOTES_PREFIX = 'DEBUG batch=';
const OOS = new Set([
  'maintenance',
  'out_of_service',
  'out-of-service',
  'fuera_de_servicio',
  'fuera-de-servicio',
  'oos',
  'blocked',
  'bloqueada'
]);

const SCENARIOS = {
  arrival_today: {
    status: 'CONFIRMADA',
    checkInOffset: 0,
    nights: 2,
    settle: false
  },
  arrival_late: {
    status: 'PENDIENTE',
    checkInOffset: -2,
    nights: 4,
    settle: false
  },
  stay_active: {
    status: 'INGRESADA',
    checkInOffset: -1,
    nights: 3,
    settle: false,
    meals: true
  },
  depart_today: {
    status: 'INGRESADA',
    checkInOffset: -2,
    nights: 2,
    settle: 'mixed'
  },
  depart_late: {
    status: 'INGRESADA',
    checkInOffset: -4,
    nights: 2,
    settle: false
  },
  finished: {
    status: 'FINALIZADA',
    checkInOffset: -5,
    nights: 2,
    settle: true
  },
  cancelled: {
    status: 'CANCELADA',
    checkInOffset: 0,
    nights: 2,
    settle: false
  }
};

const PACK_RECEPCION = [
  'arrival_today',
  'arrival_late',
  'stay_active',
  'depart_today',
  'depart_late'
];

function shiftIso(iso, days) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function nightsBetween(startIso, endIso) {
  const a = Date.parse(`${startIso}T00:00:00Z`);
  const b = Date.parse(`${endIso}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86400000));
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveDateWindow(options = {}) {
  const today = options.today;
  if (!isIsoDate(today)) {
    throw new Error('today inválido (yyyy-MM-dd)');
  }
  const from = options.from || options.dateFrom || today;
  const to = options.to || options.dateTo || shiftIso(today, 7);
  if (!isIsoDate(from) || !isIsoDate(to)) {
    throw new Error('from/to inválidos (yyyy-MM-dd)');
  }
  if (to <= from) {
    throw new Error('El rango desde/hasta debe tener al menos 1 noche (hasta > desde)');
  }
  return { today, from, to };
}

/**
 * Coloca la estancia ideal del escenario dentro de [from, to) half-open (checkOut exclusivo).
 * Packs de ocupación usan todo el rango.
 */
function placeStayInRange({ key, tpl, today, from, to, nightsOverride, pack }) {
  const maxNights = nightsBetween(from, to);
  if (maxNights < 1) {
    return { skipped: true, reason: 'Rango sin noches' };
  }

  if (pack === 'hotel_full' || pack === 'hotel_almost_full') {
    return { skipped: false, checkIn: from, checkOut: to };
  }

  const idealNights = nightsOverride || tpl.nights;
  let checkIn = shiftIso(today, tpl.checkInOffset);
  let checkOut = shiftIso(checkIn, idealNights);

  if (checkIn < from) checkIn = from;
  if (checkOut > to) checkOut = to;
  if (checkOut <= checkIn) {
    // Reubicar: anclar según tipo de escenario
    if (key === 'depart_today' || key === 'depart_late' || key === 'finished') {
      checkOut = to < today ? to : today <= to ? today : to;
      if (checkOut <= from) checkOut = to;
      checkIn = shiftIso(checkOut, -Math.min(idealNights, maxNights));
      if (checkIn < from) checkIn = from;
    } else if (key === 'arrival_today' || key === 'arrival_late' || key === 'cancelled') {
      checkIn = from > today ? from : today >= from && today < to ? today : from;
      checkOut = shiftIso(checkIn, Math.min(idealNights, nightsBetween(checkIn, to)));
    } else {
      checkIn = from;
      checkOut = shiftIso(from, Math.min(idealNights, maxNights));
    }
  }

  if (checkOut <= checkIn || checkIn < from || checkOut > to) {
    return { skipped: true, reason: 'No cabe en el rango desde/hasta' };
  }
  return { skipped: false, checkIn, checkOut };
}

function isRoomOutOfService(room) {
  const status = String(room?.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return OOS.has(status);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function batchNotes(batchId) {
  return `${DEBUG_NOTES_PREFIX}${batchId}`;
}

function parseBatchIdFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const m = notes.match(/DEBUG batch=([A-Za-z0-9-]+)/);
  return m ? m[1] : null;
}

async function listInServiceRooms() {
  const rooms = await prisma.room.findMany({
    include: { roomType: true },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }]
  });
  return rooms.filter((r) => !isRoomOutOfService(r));
}

async function findFreeRoom(rooms, startIso, endIso, reservedIds = new Set()) {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  const candidates = rooms.filter((r) => !reservedIds.has(r.id));
  if (!candidates.length) return null;

  const segments = await prisma.reservationSegment.findMany({
    where: {
      isActive: true,
      roomId: { in: candidates.map((r) => r.id) },
      reservation: {
        status: { notIn: ['CANCELADA', 'NO_PRESENTADA'] }
      }
    },
    select: {
      roomId: true,
      startDate: true,
      endDate: true
    }
  });

  const byRoom = new Map();
  for (const seg of segments) {
    if (!byRoom.has(seg.roomId)) byRoom.set(seg.roomId, []);
    byRoom.get(seg.roomId).push(seg);
  }

  for (const room of candidates) {
    const segs = byRoom.get(room.id) || [];
    const busy = segs.some((seg) =>
      rangesOverlap(start, end, new Date(seg.startDate), new Date(seg.endDate))
    );
    if (!busy) return room;
  }
  return null;
}

async function resolveServiceTypeId(preferredId, { meals = false } = {}) {
  if (preferredId) {
    const found = await prisma.serviceType.findFirst({
      where: { id: String(preferredId), isActive: true }
    });
    if (found) return found.id;
  }

  const active = await prisma.serviceType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });
  if (!active.length) throw new Error('No hay ServiceType activo en el hotel');

  const byHint = (hints) =>
    active.find((s) => {
      const n = String(s.name || '').toLowerCase();
      return hints.some((h) => n.includes(h));
    });

  if (meals) {
    const media = byHint(['media pensión', 'media pension', 'pensión', 'pension']);
    if (media) return media.id;
    const desayuno = byHint(['desayuno']);
    if (desayuno) return desayuno.id;
  }

  const solo = byHint(['solo alojamiento', 'alojamiento']);
  return (solo || active[0]).id;
}

async function resolveEfectivoMethod() {
  const cfg = await prisma.paymentMethodConfig.findFirst({
    where: {
      activo: true,
      OR: [
        { code: 'EFECTIVO' },
        { label: { equals: 'Efectivo', mode: 'insensitive' } }
      ]
    },
    orderBy: { ordenIndex: 'asc' }
  });
  return cfg;
}

async function resolveConsumoSubcategoria() {
  return prisma.subcategoriaCargo.findFirst({
    where: {
      esActivo: true,
      tipo: 'CONSUMO',
      OR: [{ codigo: 'BEBIDAS' }, { codigo: 'MINUTAS' }, { codigo: 'CAFETERIA' }]
    },
    orderBy: { ordenIndex: 'asc' }
  });
}

async function ensureDebugClient(batchId, index, reuseClient, { withPlate = false } = {}) {
  const email = `debug+${batchId.slice(0, 8)}@riviera.local`;
  if (reuseClient) {
    const existing = await prisma.client.findFirst({
      where: {
        OR: [
          { email },
          { AND: [{ firstName: 'DEBUG' }, { esFicticio: true }] }
        ]
      },
      orderBy: { id: 'asc' }
    });
    if (existing) {
      if (withPlate && !existing.vehiclePlate) {
        return prisma.client.update({
          where: { id: existing.id },
          data: { vehiclePlate: `DBG${String(100 + index).slice(-3)}` }
        });
      }
      return existing;
    }
  }

  return prisma.client.create({
    data: {
      firstName: 'DEBUG',
      lastName: `Lote ${batchId.slice(0, 8)} #${index}`,
      email: reuseClient ? email : `debug+${batchId}-${index}@riviera.local`,
      documentType: 'DNI',
      documentNumber: `DBG${String(Date.now()).slice(-6)}${index}`,
      vehiclePlate: withPlate ? `DBG${String(100 + index).slice(-3)}` : null,
      esFicticio: true,
      notes: batchNotes(batchId)
    }
  });
}

async function addLodgingCargo({
  reservationId,
  account,
  roomTypeId,
  serviceTypeId,
  nights,
  nightAmount,
  batchId
}) {
  const monto = Number(nightAmount) * nights;
  if (!(monto > 0)) return null;
  return prisma.cargo.create({
    data: {
      ...dualWriteReservationRefs(account, reservationId),
      roomTypeId: roomTypeId || null,
      serviceTypeId: serviceTypeId || null,
      descripcion: `DEBUG alojamiento ${nights} noche(s)`,
      monto: new Prisma.Decimal(monto),
      notas: batchNotes(batchId),
      fecha: new Date()
    }
  });
}

async function addConsumptionCargo({ reservationId, account, batchId }) {
  const sub = await resolveConsumoSubcategoria();
  if (!sub) return null;
  return prisma.cargo.create({
    data: {
      ...dualWriteReservationRefs(account, reservationId),
      subcategoriaCargoId: sub.id,
      descripcion: `DEBUG consumo ${sub.nombre}`,
      monto: new Prisma.Decimal(3500),
      notas: batchNotes(batchId),
      fecha: new Date()
    }
  });
}

async function addFullPayment({ reservationId, account, amount, batchId }) {
  const monto = Number(amount);
  if (!(monto > 0)) return null;
  const method = await resolveEfectivoMethod();
  const codigo = await allocateNextPagoCodigo(prisma);
  const montoDec = new Prisma.Decimal(monto);

  const pago = await prisma.pago.create({
    data: {
      ...dualWriteReservationRefs(account, reservationId),
      codigo,
      paymentMethodConfigId: method?.id ?? null,
      monto: montoDec,
      montoARS: montoDec,
      moneda: 'ARS',
      metodo: method?.label || 'Efectivo',
      motivo: 'Pago',
      notas: batchNotes(batchId),
      fecha: new Date()
    }
  });

  // Crédito de folio: sin PagoImputacion el Estado financiero / saldo no ve el cobro.
  await prisma.pagoImputacion.create({
    data: {
      pagoId: pago.id,
      accountId: account.id,
      reservaId: Number(reservationId),
      montoARS: montoDec,
      bonificacionARS: new Prisma.Decimal(0),
      ordenIndex: 0
    }
  });

  await syncAccountStatusFromBalance(prisma, account.id, 0);
  return pago;
}

function expandScenarioList({ scenarios, pack, roomsCount }) {
  if (pack === 'recepcion') return [...PACK_RECEPCION];
  if (pack === 'hotel_almost_full') {
    const n = Math.max(1, Math.floor(roomsCount * 0.85));
    return Array.from({ length: n }, () => 'stay_active');
  }
  if (pack === 'hotel_full') {
    return Array.from({ length: Math.max(1, roomsCount) }, () => 'stay_active');
  }
  const list = Array.isArray(scenarios) && scenarios.length
    ? scenarios
    : PACK_RECEPCION;
  return list.filter((key) => SCENARIOS[key]);
}

async function buildPlan(options = {}) {
  const { today, from, to } = resolveDateWindow(options);
  const nightAmount = Number(options.nightAmount) > 0 ? Number(options.nightAmount) : 50000;
  const nightsOverride =
    options.nights != null && options.nights !== ''
      ? Math.min(30, Math.max(1, Number(options.nights)))
      : null;
  const rooms = await listInServiceRooms();
  const scenarioKeys = expandScenarioList({
    scenarios: options.scenarios,
    pack: options.pack,
    roomsCount: rooms.length
  });

  const planned = [];
  const reservedIds = new Set();

  for (let i = 0; i < scenarioKeys.length; i += 1) {
    const key = scenarioKeys[i];
    const tpl = SCENARIOS[key];
    const meals = Boolean(tpl.meals);
    const serviceTypeId = await resolveServiceTypeId(options.serviceTypeId, { meals });
    const placed = placeStayInRange({
      key,
      tpl,
      today,
      from,
      to,
      nightsOverride,
      pack: options.pack
    });
    if (placed.skipped) {
      planned.push({
        scenario: key,
        skipped: true,
        reason: placed.reason || 'Fuera de rango'
      });
      continue;
    }
    const { checkIn, checkOut } = placed;
    const room = await findFreeRoom(rooms, checkIn, checkOut, reservedIds);
    if (!room) {
      planned.push({
        scenario: key,
        skipped: true,
        reason: 'Sin habitación libre'
      });
      continue;
    }
    reservedIds.add(room.id);
    let settle = false;
    if (tpl.settle === true) settle = true;
    else if (tpl.settle === 'mixed') settle = i % 2 === 0;
    else if (options.settleMode === 'all') settle = true;
    else if (options.settleMode === 'none') settle = false;

    const maxPeople = Math.max(1, Number(room.maxPeople) || 2);
    const guestCount = Math.min(2, maxPeople);

    planned.push({
      scenario: key,
      skipped: false,
      status: tpl.status,
      checkIn,
      checkOut,
      nights: nightsBetween(checkIn, checkOut),
      roomId: room.id,
      roomName: room.name,
      roomTypeId: room.roomTypeId,
      roomMaxPeople: maxPeople,
      roomSuperficie: room.superficie ?? null,
      serviceTypeId: String(serviceTypeId),
      guestCount,
      nightAmount,
      settle,
      meals,
      withPlate: key === 'arrival_today' || key === 'stay_active'
    });
  }

  return {
    today,
    from,
    to,
    roomsInService: rooms.length,
    planned
  };
}

async function createFromPlan(plan, options = {}) {
  const batchId = randomUUID();
  const reuseClient = options.reuseClient !== false;
  const created = [];

  let index = 0;
  for (const item of plan.planned) {
    if (item.skipped) {
      created.push({ ...item, batchId });
      continue;
    }
    index += 1;
    const client = await ensureDebugClient(batchId, index, reuseClient, {
      withPlate: Boolean(item.withPlate)
    });
    const reservation = await createReservationWithSegments({
      mainClientId: client.id,
      status: item.status,
      notes: batchNotes(batchId),
      source: 'MOSTRADOR',
      createdWithManualRate: true,
      includeHolderAsGuest: true,
      segments: [
        {
          roomId: item.roomId,
          roomTypeId: item.roomTypeId,
          startDate: item.checkIn,
          endDate: item.checkOut,
          guestCount: item.guestCount || 1,
          services: [String(item.serviceTypeId)],
          baseRate: item.nightAmount,
          reason: `DEBUG ${item.scenario}`,
          notes: batchNotes(batchId),
          bedPreferenceNone: true
        }
      ]
    });

    if (item.meals) {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          notaComidas: 'DEBUG: sin cebolla',
          dietVegetariano: true,
          vehiclePlate: client.vehiclePlate || null
        }
      });
    } else if (client.vehiclePlate) {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { vehiclePlate: client.vehiclePlate }
      });
    }

    const account = await ensureReservationAccount(
      prisma,
      reservation.id,
      client.id
    );

    const existingCargos = await prisma.cargo.count({
      where: { accountId: account.id }
    });
    if (existingCargos === 0) {
      await addLodgingCargo({
        reservationId: reservation.id,
        account,
        roomTypeId: item.roomTypeId,
        serviceTypeId: String(item.serviceTypeId),
        nights: item.nights,
        nightAmount: item.nightAmount,
        batchId
      });
    }

    if (item.meals) {
      await addConsumptionCargo({
        reservationId: reservation.id,
        account,
        batchId
      });
    }

    const cargos = await prisma.cargo.findMany({
      where: { accountId: account.id },
      select: { monto: true }
    });
    const totalCargos = cargos.reduce((s, c) => s + Number(c.monto), 0);

    if (item.settle && totalCargos > 0) {
      await addFullPayment({
        reservationId: reservation.id,
        account,
        amount: totalCargos,
        batchId
      });
    }

    created.push({
      scenario: item.scenario,
      skipped: false,
      reservationId: reservation.id,
      roomId: item.roomId,
      roomName: item.roomName,
      status: item.status,
      checkIn: item.checkIn,
      checkOut: item.checkOut,
      settled: Boolean(item.settle),
      batchId
    });
  }

  return {
    batchId,
    today: plan.today,
    from: plan.from,
    to: plan.to,
    roomsInService: plan.roomsInService,
    created
  };
}

async function previewFakeReservations(options) {
  return buildPlan(options);
}

async function generateFakeReservations(options) {
  const plan = await buildPlan(options);
  return createFromPlan(plan, options);
}

async function listDebugReservationIds(batchId) {
  const where = batchId
    ? { notes: { contains: `${DEBUG_NOTES_PREFIX}${batchId}` } }
    : { notes: { contains: DEBUG_NOTES_PREFIX } };
  const rows = await prisma.reservation.findMany({
    where,
    select: { id: true, notes: true, mainClientId: true }
  });
  return rows;
}

async function deleteReservationCascade(reservationId) {
  const id = parseInt(reservationId, 10);
  const account = await prisma.account.findUnique({
    where: { reservationId: id }
  });

  if (account) {
    // PagoImputacion.account / .reserva son Restrict: hay que limpiar folio antes.
    const imputaciones = await prisma.pagoImputacion.findMany({
      where: { OR: [{ accountId: account.id }, { reservaId: id }] },
      select: { id: true, pagoId: true }
    });
    const pagoIds = [...new Set(imputaciones.map((i) => i.pagoId))];

    await prisma.discountApplication.deleteMany({
      where: {
        OR: [
          { accountId: account.id },
          ...(pagoIds.length ? [{ pagoId: { in: pagoIds } }] : [])
        ]
      }
    });

    if (imputaciones.length) {
      await prisma.pagoImputacion.deleteMany({
        where: { id: { in: imputaciones.map((i) => i.id) } }
      });
    }

    if (pagoIds.length) {
      // Borrar solo pagos que ya no tienen otras imputaciones (p.ej. multi-folio).
      for (const pagoId of pagoIds) {
        const left = await prisma.pagoImputacion.count({ where: { pagoId } });
        if (left > 0) continue;
        await prisma.pagoAdjunto.deleteMany({ where: { pagoId } }).catch(() => {});
        await prisma.pagoFactura.deleteMany({ where: { pagoId } }).catch(() => {});
        await prisma.pago.delete({ where: { id: pagoId } }).catch(() => {});
      }
    }

    await prisma.pago.deleteMany({
      where: { OR: [{ accountId: account.id }, { reservaId: id }] }
    });
    await prisma.cargo.deleteMany({
      where: { OR: [{ accountId: account.id }, { reservaId: id }] }
    });
    await prisma.account.delete({ where: { id: account.id } }).catch(() => {});
  } else {
    await prisma.pagoImputacion.deleteMany({ where: { reservaId: id } }).catch(() => {});
    await prisma.pago.deleteMany({ where: { reservaId: id } }).catch(() => {});
    await prisma.cargo.deleteMany({ where: { reservaId: id } }).catch(() => {});
  }

  await prisma.guest.deleteMany({ where: { reservationId: id } });
  await prisma.onlineCheckIn.deleteMany({ where: { reservationId: id } }).catch(() => {});
  await prisma.reservationNightRate.deleteMany({ where: { reservationId: id } }).catch(() => {});
  await prisma.reservationSegment.deleteMany({ where: { reservationId: id } });
  await prisma.reservation.delete({ where: { id } });
}

async function cleanupDebugClients(clientIds) {
  let deleted = 0;
  for (const clientId of clientIds) {
    const left = await prisma.reservation.count({
      where: { mainClientId: clientId }
    });
    if (left > 0) continue;
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) continue;
    const isDebug =
      client.esFicticio ||
      (client.email && String(client.email).endsWith('@riviera.local')) ||
      client.firstName === 'DEBUG' ||
      (client.notes && client.notes.includes(DEBUG_NOTES_PREFIX));
    if (!isDebug) continue;
    await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
    deleted += 1;
  }
  return deleted;
}

async function deleteFakeReservations({ batchId } = {}) {
  const rows = await listDebugReservationIds(batchId || null);
  const clientIds = [...new Set(rows.map((r) => r.mainClientId).filter(Boolean))];
  for (const row of rows) {
    await deleteReservationCascade(row.id);
  }
  const clientsDeleted = await cleanupDebugClients(clientIds);
  return {
    deletedReservations: rows.length,
    clientsDeleted,
    batchId: batchId || null
  };
}

module.exports = {
  SCENARIOS,
  PACK_RECEPCION,
  DEBUG_NOTES_PREFIX,
  parseBatchIdFromNotes,
  previewFakeReservations,
  generateFakeReservations,
  deleteFakeReservations,
  listDebugReservationIds
};
