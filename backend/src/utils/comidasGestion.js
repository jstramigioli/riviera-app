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
const { Decimal } = require('@prisma/client/runtime/library');
const { toDateOnlyUtc, civilFromDb } = require('./calendarDates');
const { ensureReservationAccount, createExternalAccount } = require('./accountHelpers');
const { ensureCanonicalConsumoGroups } = require('./menuGroups');
const {
  addLinesToComanda,
  createComanda,
  lineDescription,
  refreshAccountStatus,
  removeComandaLineForCargo
} = require('./comandas');
const { CENAS_CATEGORY, resolveCenaVariety } = require('./cenas');
const { GENERATING_STATUSES } = require('./prestacionesComida');
const { ensureBeneficioParaCena, reconcileBeneficios } = require('./beneficios');

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

/** Edad del comensal: NINO (5 a 10) paga la mitad; MENOR (menos de 5) no paga. */
const EDADES = ['ADULTO', 'NINO', 'MENOR'];
const EDAD_SUFIJO = { ADULTO: null, NINO: '5 a 10 años', MENOR: 'menor de 5' };
const DIETA_KEYS = ['dietVegetariano', 'dietVegano', 'dietCeliaco'];

function adultoSinDieta() {
  return { edad: 'ADULTO', dietVegetariano: false, dietVegano: false, dietCeliaco: false };
}

/**
 * Detalle por comensal: [{ edad, dietVegetariano, dietVegano, dietCeliaco }].
 * Sin detalle: `pax` adultos sin dieta.
 */
function parseComensales(raw, paxFallback) {
  if (raw == null) {
    return Array.from({ length: parsePax(paxFallback) }, adultoSinDieta);
  }
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 99) {
    throw new ComidaInputError('Cantidad de comensales inválida (1 a 99)');
  }
  return raw.map((c) => {
    const edad = EDADES.includes(c?.edad) ? c.edad : null;
    if (!edad) throw new ComidaInputError('Edad de comensal inválida');
    const out = { edad };
    for (const k of DIETA_KEYS) out[k] = Boolean(c?.[k]);
    const otra = typeof c?.dietOtra === 'string' ? c.dietOtra.trim().slice(0, 120) : '';
    if (otra) out.dietOtra = otra;
    return out;
  });
}

/**
 * Líneas de la cena según el detalle: una por edad presente. Adultos al precio
 * base, de 5 a 10 años a la mitad, menores de 5 sin cargo (línea bonificada).
 */
function cenaLinesFromComensales({ item, varietyId, varietyName, precioBase }, detalle) {
  const base = new Decimal(precioBase);
  const lines = [];
  for (const edad of EDADES) {
    const n = detalle.filter((c) => c.edad === edad).length;
    if (!n) continue;
    const precioUnitario =
      edad === 'ADULTO' ? base : edad === 'NINO' ? base.div(2).toDecimalPlaces(2) : new Decimal(0);
    const variedadLabel = [varietyName, EDAD_SUFIJO[edad]].filter(Boolean).join(' · ') || null;
    lines.push({
      menuItemId: item.id,
      varietyId,
      category: CENAS_CATEGORY,
      descripcion: lineDescription(item.name, variedadLabel, n),
      cantidad: n,
      precioUnitario,
      subtotal: precioUnitario.mul(n),
      ...(edad === 'MENOR' ? { bonificado: true } : {})
    });
  }
  return lines;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cliente nuevo para una cena externa: nombre, apellido y al menos un contacto. */
function parseClienteNuevo(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const firstName = cleanText(c.firstName, 80);
  const lastName = cleanText(c.lastName, 80);
  const phone = cleanText(c.phone, 40);
  const email = cleanText(c.email, 120);
  if (!firstName || !lastName) throw new ComidaInputError('Ingresá nombre y apellido del cliente');
  if (!phone && !email) throw new ComidaInputError('Ingresá un teléfono o un email de contacto');
  if (email && !EMAIL_RE.test(email)) throw new ComidaInputError('El email no es válido');
  return { firstName, lastName, phone, email: email ? email.toLowerCase() : null };
}

/**
 * Registra una cena no incluida en el régimen y crea su comanda de Cena.
 * body: { fecha, menuItemId, variedad?: 'ALOJADO'|'EXTERNO', pax, notas?,
 *         reservationId? | clientId? | cliente?: { firstName, lastName, phone?, email? } | accountId? }
 * Externo: cliente existente (clientId) o uno nuevo que se crea con la cena.
 */
async function registrarCenaManual(db, body = {}) {
  const fecha = parseFechaCivil(body.fecha);
  const detalle = parseComensales(body.comensales, body.pax);
  const pax = detalle.length;
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
    const clientId = body.clientId != null && body.clientId !== '' ? Number(body.clientId) : null;
    if (accountId != null) {
      account = await db.account.findUnique({ where: { id: accountId } });
      if (!account || account.kind !== 'EXTERNAL') {
        throw new ComidaInputError('Cuenta externa inválida');
      }
      externo = { nombre: account.label || null, telefono: null, clientId: account.clientId || null };
    } else if (clientId != null) {
      const client = await db.client.findUnique({
        where: { id: clientId },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true }
      });
      if (!client) throw new ComidaInputError('Cliente no encontrado', 404);
      externo = {
        nombre: `${client.firstName} ${client.lastName}`.trim(),
        telefono: client.phone || client.email || null,
        clientId: client.id
      };
    } else {
      const nuevo = parseClienteNuevo(body.cliente);
      externo = {
        nombre: `${nuevo.firstName} ${nuevo.lastName}`,
        telefono: nuevo.phone || nuevo.email,
        clienteNuevo: nuevo
      };
    }
    variedad = variedad || 'EXTERNO';
  }

  const { item, variety } = await resolveCenaVariety(db, menuItemId, variedad);
  const subcatByCode = await cenasSubcatByCode(db);
  const cenaInfo = {
    menuItemId: item.id,
    varietyId: variety.id,
    varietyName: variety.name,
    precioBase: Number(variety.price)
  };
  const lines = cenaLinesFromComensales({ ...cenaInfo, item }, detalle);

  return db.$transaction(async (tx) => {
    let cuenta = account;
    if (!cuenta) {
      let clientIdCuenta = externo.clientId || null;
      if (externo.clienteNuevo) {
        const creado = await tx.client.create({ data: externo.clienteNuevo });
        clientIdCuenta = creado.id;
      }
      cuenta = await createExternalAccount(tx, { label: externo.nombre, clientId: clientIdCuenta });
    }
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
      comensales: { ...cenaInfo, detalle },
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
        await quitarLineasDeCena(tx, p.comandaId);
        await refreshAccountStatus(tx, comanda.accountId);
      }
    }
    const updated = await tx.prestacionComida.update({
      where: { id },
      data: {
        estado: 'CANCELADA',
        canceladaAt: new Date(),
        motivoCancelacion: cleanText(motivo, 300)
      }
    });
    // Cena incluida cancelada → Almuerzo sin cargo (o lo restaura si se había anulado).
    if (updated.origen === 'REGIMEN' && updated.tipo === 'CENA' && updated.reservationId) {
      await ensureBeneficioParaCena(tx, updated);
      await reconcileBeneficios(tx, updated.reservationId);
    }
    return updated;
  });
}

/** Reactiva una cena/desayuno incluido cancelado. Las manuales se vuelven a cargar. */
async function reactivarPrestacion(db, id) {
  const p = await findPrestacion(db, id);
  if (p.estado === 'PREVISTA') return p;
  if (p.origen !== 'REGIMEN') {
    throw new ComidaInputError('Para una cena manual cancelada, volvé a cargarla');
  }
  const beneficio = await db.beneficioGastronomico.findUnique({ where: { prestacionId: id } });
  if (beneficio?.estado === 'UTILIZADO') {
    throw new ComidaInputError(
      `El almuerzo sin cargo de esta cena ya se usó (comanda #${beneficio.comandaId}); anulá esa comanda para reactivar la cena`,
      409
    );
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.prestacionComida.update({
      where: { id },
      data: { estado: 'PREVISTA', canceladaAt: null, motivoCancelacion: null }
    });
    if (updated.reservationId) await reconcileBeneficios(tx, updated.reservationId);
    return updated;
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

  let detalle;
  if (body.comensales !== undefined) {
    if (p.origen !== 'MANUAL') throw new ComidaInputError('Solo las cenas adicionales tienen detalle por comensal');
    detalle = parseComensales(body.comensales);
  } else if (body.pax !== undefined) {
    const pax = parsePax(body.pax);
    if (p.origen === 'MANUAL') {
      // Sin detalle: conserva los comensales actuales y agrega/quita adultos al final.
      const actual = Array.isArray(p.comensales?.detalle) ? p.comensales.detalle : parseComensales(null, p.pax);
      detalle = actual.slice(0, pax);
      while (detalle.length < pax) detalle.push(adultoSinDieta());
    } else {
      // Las incluidas siguen a la reserva: no se cambia su cantidad a mano
      // (para no cenar se cambia por almuerzo; para sumar gente, una cena adicional).
      throw new ComidaInputError('La cantidad de una comida incluida sigue a la reserva');
    }
  }
  if (detalle) data.pax = detalle.length;

  return db.$transaction(async (tx) => {
    if (detalle) {
      const cenaInfo = await cenaInfoDePrestacion(tx, p);
      data.comensales = { ...cenaInfo, detalle };
      const comanda = p.comandaId ? await tx.comanda.findUnique({ where: { id: p.comandaId } }) : null;
      if (comanda && comanda.estado === 'ACTIVA' && p.estado === 'PREVISTA') {
        await quitarLineasDeCena(tx, p.comandaId, { reemplazo: true });
        const item = await tx.menuItem.findUnique({ where: { id: cenaInfo.menuItemId } });
        const account = await tx.account.findUnique({ where: { id: comanda.accountId } });
        await addLinesToComanda(tx, {
          comanda,
          account,
          lines: cenaLinesFromComensales({ ...cenaInfo, item }, detalle),
          subcatByCode: await cenasSubcatByCode(tx)
        });
      }
    }
    return Object.keys(data).length
      ? tx.prestacionComida.update({ where: { id }, data })
      : p;
  });
}

/** Tipo, variedad y precio base de la cena (guardados o, en cenas viejas, desde la línea adulta). */
async function cenaInfoDePrestacion(tx, p) {
  if (p.comensales?.menuItemId) {
    const { menuItemId, varietyId, varietyName, precioBase } = p.comensales;
    return { menuItemId, varietyId, varietyName, precioBase };
  }
  const lines = p.comandaId ? await cenaLines(tx, p.comandaId) : [];
  const line = lines.find((l) => !l.bonificado) || lines[0];
  if (!line) throw new ComidaInputError('La cena no tiene línea en su comanda');
  return {
    menuItemId: line.menuItemId,
    varietyId: line.varietyId,
    varietyName: line.variety?.name || null,
    precioBase: Number(line.precioUnitario)
  };
}

/**
 * Quita las líneas de cena (grupo CENAS) de una comanda, con sus cargos.
 * reemplazo: se vuelven a cargar enseguida, así que la comanda no se anula aunque quede vacía.
 */
async function quitarLineasDeCena(tx, comandaId, { reemplazo = false } = {}) {
  for (const line of await cenaLines(tx, comandaId)) {
    if (reemplazo) {
      await tx.comandaItem.delete({ where: { id: line.id } });
      if (line.cargoId) await tx.cargo.delete({ where: { id: line.cargoId } });
    } else if (line.cargoId) {
      await removeComandaLineForCargo(tx, line.cargoId);
      await tx.cargo.delete({ where: { id: line.cargoId } });
    } else {
      await tx.comandaItem.delete({ where: { id: line.id } });
    }
  }
}

module.exports = {
  ComidaInputError,
  isNightOfStay,
  registrarCenaManual,
  cancelarPrestacion,
  reactivarPrestacion,
  actualizarPrestacion,
  parseComensales,
  cenaLinesFromComensales
};
