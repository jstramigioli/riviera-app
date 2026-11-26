/**
 * Gestión operativa de comidas previstas: cenas manuales (con su comanda de
 * Cena), cancelaciones, reactivaciones y edición de comensales.
 *
 * - Cena manual (externo o huésped sin cena incluida): crea una comanda de
 *   ámbito Cena con el tipo de cena × comensales (genera cargo); luego se le
 *   agregan las bebidas. Cancelarla quita la línea de la cena (las bebidas
 *   ya cargadas no se tocan).
 * - Cena incluida (REGIMEN): cancelar no toca dinero; se puede reactivar.
 */
const { toDateOnlyUtc, civilFromDb } = require('./calendarDates');
const { ensureReservationAccount, createExternalAccount } = require('./accountHelpers');
const { ensureCanonicalConsumoGroups } = require('./menuGroups');
const {
  buildComandaLines,
  createComanda,
  lineDescription,
  refreshAccountStatus,
  removeComandaLineForCargo
} = require('./comandas');
const { CENAS_CATEGORY, resolveCenaVariety } = require('./cenas');
const { GENERATING_STATUSES } = require('./prestacionesComida');

class ComidaInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function parseFechaCivil(value) {
  const s = String(value ?? '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ComidaInputError('Fecha inválida (YYYY-MM-DD)');
  return s;
}

function parsePax(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    throw new ComidaInputError('Cantidad de comensales inválida (1 a 99)');
  }
  return n;
}

function cleanText(value, max = 200) {
  if (value == null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

/** ¿La fecha es una noche de la estadía (check-in ≤ fecha < check-out)? */
function isNightOfStay(segments, fechaCivil) {
  return (segments || []).some((seg) => {
    if (seg.isActive === false) return false;
    const start = civilFromDb(seg.startDate);
    const end = civilFromDb(seg.endDate);
    return start <= fechaCivil && fechaCivil < end;
  });
}

async function cenasSubcatByCode(db) {
  let sub = await db.subcategoriaCargo.findFirst({
    where: { tipo: 'CONSUMO', codigo: CENAS_CATEGORY, esActivo: true }
  });
  if (!sub) {
    await ensureCanonicalConsumoGroups(db);
    sub = await db.subcategoriaCargo.findFirst({
      where: { tipo: 'CONSUMO', codigo: CENAS_CATEGORY, esActivo: true }
    });
  }
  return new Map([[CENAS_CATEGORY, sub]]);
}

/**
 * Registra una cena no incluida en el régimen y crea su comanda de Cena.
 * body: { fecha, menuItemId, variedad?: 'ALOJADO'|'EXTERNO', pax, notas?,
 *         reservationId? | nombreExterno?, telefono?, accountId? }
 */
async function registrarCenaManual(db, body = {}) {
  const fecha = parseFechaCivil(body.fecha);
  const pax = parsePax(body.pax);
  const notas = cleanText(body.notas, 500);
  const menuItemId = Number(body.menuItemId);
  if (!Number.isInteger(menuItemId)) throw new ComidaInputError('Elegí el tipo de cena');
  const reservationId =
    body.reservationId != null && body.reservationId !== '' ? Number(body.reservationId) : null;

  let account = null;
  let reuse = null;
  let externo = null;
  let variedad = body.variedad === 'EXTERNO' || body.variedad === 'ALOJADO' ? body.variedad : null;

  if (reservationId != null) {
    const reservation = await db.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        status: true,
        mainClientId: true,
        segments: { select: { startDate: true, endDate: true, isActive: true } }
      }
    });
    if (!reservation) throw new ComidaInputError('Reserva no encontrada', 404);
    if (!GENERATING_STATUSES.has(reservation.status)) {
      throw new ComidaInputError('La reserva no está activa');
    }
    if (!isNightOfStay(reservation.segments, fecha)) {
      throw new ComidaInputError('La fecha no corresponde a una noche de la estadía');
    }
    const existentes = await db.prestacionComida.findMany({
      where: { reservationId, fecha: toDateOnlyUtc(fecha), tipo: 'CENA' }
    });
    const regimen = existentes.find((p) => p.origen === 'REGIMEN' && p.vigente);
    if (regimen) {
      throw new ComidaInputError(
        regimen.estado === 'CANCELADA'
          ? 'La reserva tiene la cena incluida (cancelada) ese día: reactivala en lugar de cargar otra'
          : 'La reserva ya tiene la cena incluida en su régimen ese día',
        409
      );
    }
    const manual = existentes.find((p) => p.origen === 'MANUAL');
    if (manual && manual.estado === 'PREVISTA') {
      throw new ComidaInputError('Ya hay una cena registrada para esta reserva ese día', 409);
    }
    reuse = manual || null;
    account = await ensureReservationAccount(db, reservationId, reservation.mainClientId);
    variedad = variedad || 'ALOJADO';
  } else {
    const accountId = body.accountId != null && body.accountId !== '' ? Number(body.accountId) : null;
    const nombre = cleanText(body.nombreExterno, 120);
    if (accountId != null) {
      account = await db.account.findUnique({ where: { id: accountId } });
      if (!account || account.kind !== 'EXTERNAL') {
        throw new ComidaInputError('Cuenta externa inválida');
      }
    } else if (!nombre) {
      throw new ComidaInputError('Ingresá el nombre del comensal externo');
    }
    externo = { nombre: nombre || account?.label || null, telefono: cleanText(body.telefono, 40) };
    variedad = variedad || 'EXTERNO';
  }

  const { item, variety } = await resolveCenaVariety(db, menuItemId, variedad);
  const subcatByCode = await cenasSubcatByCode(db);
  const lines = buildComandaLines(
    [{ menuItemId: item.id, quantity: pax, variety }],
    new Map([[item.id, item]])
  );

  return db.$transaction(async (tx) => {
    const cuenta = account || (await createExternalAccount(tx, { label: externo.nombre }));
    const { comanda } = await createComanda(tx, {
      ambito: 'CENA',
      fecha: toDateOnlyUtc(fecha),
      account: cuenta,
      notas,
      lines,
      subcatByCode
    });
    const data = {
      pax,
      paxManual: false,
      estado: 'PREVISTA',
      vigente: true,
      canceladaAt: null,
      motivoCancelacion: null,
      notas,
      comandaId: comanda.id
    };
    const prestacion = reuse
      ? await tx.prestacionComida.update({ where: { id: reuse.id }, data })
      : await tx.prestacionComida.create({
          data: {
            ...data,
            fecha: toDateOnlyUtc(fecha),
            tipo: 'CENA',
            origen: 'MANUAL',
            incluida: false,
            reservationId,
            nombreExterno: externo?.nombre ?? null,
            telefono: externo?.telefono ?? null
          }
        });
    return { prestacion, comanda };
  });
}

async function findPrestacion(db, id) {
  const p = await db.prestacionComida.findUnique({ where: { id } });
  if (!p) throw new ComidaInputError('Comida no encontrada', 404);
  return p;
}

/** Líneas de cena (grupo CENAS) de la comanda de una cena manual. */
async function cenaLines(tx, comandaId) {
  return tx.comandaItem.findMany({
    where: { comandaId, menuItem: { category: CENAS_CATEGORY } },
    include: { menuItem: { select: { name: true } }, variety: { select: { name: true } } }
  });
}

/** Cancela una comida prevista. En cenas manuales quita la línea de la cena de su comanda. */
async function cancelarPrestacion(db, id, { motivo } = {}) {
  const p = await findPrestacion(db, id);
  if (p.estado === 'CANCELADA') return p;
  return db.$transaction(async (tx) => {
    if (p.origen === 'MANUAL' && p.comandaId) {
      const comanda = await tx.comanda.findUnique({ where: { id: p.comandaId } });
      if (comanda && comanda.estado === 'ACTIVA') {
        for (const line of await cenaLines(tx, p.comandaId)) {
          if (line.cargoId) {
            await removeComandaLineForCargo(tx, line.cargoId);
            await tx.cargo.delete({ where: { id: line.cargoId } });
          } else {
            await tx.comandaItem.delete({ where: { id: line.id } });
          }
        }
        await refreshAccountStatus(tx, comanda.accountId);
      }
    }
    return tx.prestacionComida.update({
      where: { id },
      data: {
        estado: 'CANCELADA',
        canceladaAt: new Date(),
        motivoCancelacion: cleanText(motivo, 300)
      }
    });
  });
}

/** Reactiva una cena/desayuno incluido cancelado. Las manuales se vuelven a cargar. */
async function reactivarPrestacion(db, id) {
  const p = await findPrestacion(db, id);
  if (p.estado === 'PREVISTA') return p;
  if (p.origen !== 'REGIMEN') {
    throw new ComidaInputError('Para una cena manual cancelada, volvé a cargarla');
  }
  return db.prestacionComida.update({
    where: { id },
    data: { estado: 'PREVISTA', canceladaAt: null, motivoCancelacion: null }
  });
}

/**
 * Edita comensales y/o notas. En las incluidas marca los comensales como
 * manuales (la sincronización no los pisa); en las manuales ajusta la línea
 * de la cena en su comanda (cantidad e importe).
 */
async function actualizarPrestacion(db, id, body = {}) {
  const p = await findPrestacion(db, id);
  const data = {};
  if (body.notas !== undefined) data.notas = cleanText(body.notas, 500);
  const pax = body.pax !== undefined ? parsePax(body.pax) : undefined;
  if (pax !== undefined) {
    data.pax = pax;
    if (p.origen === 'REGIMEN') data.paxManual = true;
  }

  return db.$transaction(async (tx) => {
    if (pax !== undefined && p.origen === 'MANUAL' && p.comandaId && p.estado === 'PREVISTA') {
      const comanda = await tx.comanda.findUnique({ where: { id: p.comandaId } });
      if (comanda && comanda.estado === 'ACTIVA') {
        for (const line of await cenaLines(tx, p.comandaId)) {
          const subtotal = line.precioUnitario.mul(pax);
          const descripcion = lineDescription(line.menuItem?.name || 'Cena', line.variety?.name, pax);
          await tx.comandaItem.update({
            where: { id: line.id },
            data: { cantidad: pax, subtotal, descripcion }
          });
          if (line.cargoId) {
            await tx.cargo.update({ where: { id: line.cargoId }, data: { monto: subtotal, descripcion } });
          }
        }
        await refreshAccountStatus(tx, comanda.accountId);
      }
    }
    return Object.keys(data).length
      ? tx.prestacionComida.update({ where: { id }, data })
      : p;
  });
}

module.exports = {
  ComidaInputError,
  isNightOfStay,
  registrarCenaManual,
  cancelarPrestacion,
  reactivarPrestacion,
  actualizarPrestacion
};
