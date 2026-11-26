/**
 * Prestaciones de comida (recuento de comensales por fecha).
 *
 * Las de origen REGIMEN se derivan de los tramos activos de la reserva:
 * por cada noche d de la estadía con servicio S →
 *   - CENA el día d       si S incluye cena,
 *   - DESAYUNO el día d+1 si S incluye desayuno.
 * Eso da: check-in con cena y sin desayuno; días intermedios con ambas;
 * check-out con desayuno y sin cena. Con cambio de servicio entre tramos,
 * el desayuno sigue al servicio de la noche anterior.
 *
 * La sincronización es idempotente y no pisa datos operativos
 * (cancelaciones, comensales editados a mano, notas).
 */
const prisma = require('./prisma');
const { civilFromDb, toDateOnlyUtc } = require('./calendarDates');
const { reconcileBeneficios } = require('./beneficios');

/** Estados de reserva que generan comidas previstas (incluye prerreservas). */
const GENERATING_STATUSES = new Set(['PENDIENTE', 'CONFIRMADA', 'INGRESADA', 'FINALIZADA']);

const TIPO = { DESAYUNO: 'DESAYUNO', CENA: 'CENA' };

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeServiceToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Comidas incluidas para una referencia de servicio del tramo.
 * Si es un ServiceType conocido, manda su régimen interno (incluyeDesayuno /
 * incluyeCena). Para referencias legacy (texto como 'con_desayuno') se usa
 * la misma heurística que tenía el frontend.
 */
function resolveMealFlags(ref, serviceTypesById = new Map()) {
  if (ref == null || ref === '') return { breakfast: false, dinner: false };
  const st = serviceTypesById.get(String(ref));
  if (st) {
    return { breakfast: Boolean(st.incluyeDesayuno), dinner: Boolean(st.incluyeCena) };
  }
  const blob = normalizeServiceToken(ref);
  if (blob.includes('media_pension') || blob.includes('half')) {
    return { breakfast: true, dinner: true };
  }
  if (blob.includes('solo_alojamiento') || blob.includes('sin_desayuno') || blob === 'base') {
    return { breakfast: false, dinner: false };
  }
  if (blob.includes('desayuno') || blob.includes('breakfast')) {
    return { breakfast: true, dinner: false };
  }
  return { breakfast: false, dinner: false };
}

function segmentBounds(seg) {
  return { start: civilFromDb(seg.startDate), end: civilFromDb(seg.endDate) };
}

/** Primer servicio de los tramos que cubren la noche (mismo criterio que el Libro). */
function primaryServiceRef(covering) {
  for (const seg of covering) {
    if (Array.isArray(seg.services) && seg.services[0]) return seg.services[0];
  }
  return null;
}

/**
 * Comensales de una noche: colapsa componentes de una habitación virtual
 * (el secundario suele traer guestCount=1). Igual que el panel del día.
 */
function guestsForNight(covering, { requiredGuests = 0, guestsListCount = 0 } = {}) {
  const byVirtual = new Map();
  let physicalMax = 0;
  for (const seg of covering) {
    const virtualId = seg.virtualRoomId != null ? parseInt(seg.virtualRoomId, 10) : null;
    const count = Number(seg.guestCount);
    const n = Number.isFinite(count) && count > 0 ? count : 0;
    if (virtualId) byVirtual.set(virtualId, Math.max(byVirtual.get(virtualId) || 0, n));
    else physicalMax = Math.max(physicalMax, n);
  }
  let fromSegs = physicalMax;
  for (const n of byVirtual.values()) fromSegs += n;
  return Math.max(fromSegs, Number(requiredGuests) || 0, Number(guestsListCount) || 0, 1);
}

/**
 * Prestaciones REGIMEN que debería tener la reserva.
 * reservation: { status, segments: [{ startDate, endDate, services, guestCount, virtualRoomId, isActive }], guests? }
 * Devuelve [{ fecha: 'YYYY-MM-DD', tipo: 'DESAYUNO'|'CENA', pax }] ordenado.
 */
function computeDesiredPrestaciones(reservation, serviceTypesById = new Map()) {
  if (!reservation || !GENERATING_STATUSES.has(reservation.status)) return [];
  const segments = (reservation.segments || [])
    .filter((s) => s.isActive !== false)
    .map((s) => ({ ...s, ...segmentBounds(s) }))
    .filter((s) => s.start && s.end && s.start < s.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (segments.length === 0) return [];

  const ctx = {
    requiredGuests: segments[0].guestCount,
    guestsListCount: Array.isArray(reservation.guests) ? reservation.guests.length : 0
  };

  const nights = new Set();
  for (const seg of segments) {
    for (let d = seg.start; d < seg.end; d = addDaysIso(d, 1)) nights.add(d);
  }

  const byKey = new Map();
  for (const night of [...nights].sort()) {
    const covering = segments.filter((s) => s.start <= night && night < s.end);
    const flags = resolveMealFlags(primaryServiceRef(covering), serviceTypesById);
    const pax = guestsForNight(covering, ctx);
    if (flags.dinner) byKey.set(`${night}|${TIPO.CENA}`, { fecha: night, tipo: TIPO.CENA, pax });
    if (flags.breakfast) {
      const morning = addDaysIso(night, 1);
      byKey.set(`${morning}|${TIPO.DESAYUNO}`, { fecha: morning, tipo: TIPO.DESAYUNO, pax });
    }
  }

  return [...byKey.values()].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo)
  );
}

/** Una prestación con intervención manual no se borra: se marca no vigente. */
function hasOperationalData(row) {
  return row.estado !== 'PREVISTA' || row.paxManual || Boolean(row.notas);
}

/**
 * Compara lo existente (REGIMEN) con lo deseado y devuelve las operaciones.
 * existing: [{ id, fecha (Date|ISO), tipo, pax, paxManual, estado, vigente, notas }]
 */
function planSync(existing, desired) {
  const desiredByKey = new Map(desired.map((d) => [`${d.fecha}|${d.tipo}`, d]));
  const plan = { create: [], update: [], remove: [] };
  const seen = new Set();

  for (const row of existing) {
    const fecha = civilFromDb(row.fecha);
    const key = `${fecha}|${row.tipo}`;
    seen.add(key);
    const want = desiredByKey.get(key);
    if (want) {
      const data = {};
      if (!row.vigente) data.vigente = true;
      if (!row.paxManual && row.pax !== want.pax) data.pax = want.pax;
      if (Object.keys(data).length) plan.update.push({ id: row.id, data });
    } else if (hasOperationalData(row)) {
      if (row.vigente) plan.update.push({ id: row.id, data: { vigente: false } });
    } else {
      plan.remove.push(row.id);
    }
  }

  for (const [key, want] of desiredByKey) {
    if (!seen.has(key)) plan.create.push(want);
  }
  return plan;
}

async function loadServiceTypesById(db) {
  const rows = await db.serviceType.findMany({
    select: { id: true, incluyeDesayuno: true, incluyeCena: true }
  });
  return new Map(rows.map((r) => [String(r.id), r]));
}

/**
 * Sincroniza las prestaciones REGIMEN de una reserva. Idempotente.
 * Devuelve las cantidades del plan (con dryRun no escribe nada).
 */
async function syncPrestacionesComida(
  reservationId,
  { db = prisma, serviceTypesById, dryRun = false } = {}
) {
  const id = parseInt(reservationId, 10);
  if (!Number.isInteger(id)) return null;

  const reservation = await db.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      guests: { select: { id: true } },
      segments: {
        select: {
          startDate: true,
          endDate: true,
          services: true,
          guestCount: true,
          virtualRoomId: true,
          isActive: true
        }
      }
    }
  });
  if (!reservation) return null;

  const stMap = serviceTypesById || (await loadServiceTypesById(db));
  const desired = computeDesiredPrestaciones(reservation, stMap);
  const existing = await db.prestacionComida.findMany({
    where: { reservationId: id, origen: 'REGIMEN' }
  });
  const plan = planSync(existing, desired);

  if (!dryRun && (plan.create.length || plan.update.length || plan.remove.length)) {
    await db.$transaction(async (tx) => {
      if (plan.remove.length) {
        await tx.prestacionComida.deleteMany({ where: { id: { in: plan.remove } } });
      }
      for (const u of plan.update) {
        await tx.prestacionComida.update({ where: { id: u.id }, data: u.data });
      }
      if (plan.create.length) {
        await tx.prestacionComida.createMany({
          data: plan.create.map((c) => ({
            reservationId: id,
            fecha: toDateOnlyUtc(c.fecha),
            tipo: c.tipo,
            origen: 'REGIMEN',
            incluida: true,
            pax: c.pax
          })),
          skipDuplicates: true
        });
      }
    });
  }

  // Beneficios (Almuerzo sin cargo): check-out, fechas fuera de la estadía, etc.
  const beneficiosActualizados = dryRun ? 0 : await reconcileBeneficios(db, id);

  return {
    reservationId: id,
    beneficios: beneficiosActualizados,
    created: plan.create.length,
    updated: plan.update.length,
    removed: plan.remove.length
  };
}

/**
 * Igual que syncPrestacionesComida, pero nunca hace fallar la operación de
 * reserva que la invoca (las prestaciones son derivadas y se pueden resincronizar).
 */
async function safeSyncPrestacionesComida(reservationId) {
  try {
    return await syncPrestacionesComida(reservationId);
  } catch (error) {
    console.error(`❌ Error sincronizando comidas de reserva #${reservationId}:`, error);
    return null;
  }
}

module.exports = {
  GENERATING_STATUSES,
  resolveMealFlags,
  guestsForNight,
  computeDesiredPrestaciones,
  planSync,
  syncPrestacionesComida,
  safeSyncPrestacionesComida,
  loadServiceTypesById
};
