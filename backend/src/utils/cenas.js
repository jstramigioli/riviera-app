/**
 * Tipos de cena (habitual, buffet, Navidad, …): productos del grupo CENAS con
 * dos variedades de precio, Alojado y Externo. Se administran solo desde
 * Configuración → Cenas (no desde la pestaña Menú) y funcionan como cualquier
 * producto en comandas y cargos.
 */
const { Decimal } = require('@prisma/client/runtime/library');

const CENAS_CATEGORY = 'CENAS';
const VARIEDAD = { ALOJADO: 'Alojado', EXTERNO: 'Externo' };

class CenaInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function parsePrecio(value, label) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new CenaInputError(`${label} inválido`);
  return new Decimal(Math.round(n * 100) / 100);
}

function parseNombre(value) {
  const nombre = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!nombre) throw new CenaInputError('Ingresá el nombre del tipo de cena');
  if (nombre.length > 80) throw new CenaInputError('El nombre es demasiado largo');
  return nombre;
}

function varietyOf(item, name) {
  return (item.varieties || []).find((v) => v.name === name) || null;
}

function tipoView(item) {
  const alojado = varietyOf(item, VARIEDAD.ALOJADO);
  const externo = varietyOf(item, VARIEDAD.EXTERNO);
  return {
    id: item.id,
    nombre: item.name,
    activo: item.isActive,
    ordenIndex: item.ordenIndex,
    precioAlojado: alojado ? Number(alojado.price) : null,
    precioExterno: externo ? Number(externo.price) : null,
    varietyAlojadoId: alojado?.id ?? null,
    varietyExternoId: externo?.id ?? null,
    usos: item._count?.comandaItems ?? undefined
  };
}

const TIPO_INCLUDE = {
  varieties: true,
  _count: { select: { comandaItems: true } }
};

async function listTiposCena(db, { includeInactive = false } = {}) {
  const items = await db.menuItem.findMany({
    where: { category: CENAS_CATEGORY, ...(includeInactive ? {} : { isActive: true }) },
    include: TIPO_INCLUDE,
    orderBy: [{ ordenIndex: 'asc' }, { name: 'asc' }]
  });
  return items.map(tipoView);
}

async function assertNombreLibre(db, nombre, exceptId = null) {
  const others = await db.menuItem.findMany({
    where: { category: CENAS_CATEGORY, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { name: true }
  });
  const norm = (v) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (others.some((o) => norm(o.name) === norm(nombre))) {
    throw new CenaInputError('Ya existe un tipo de cena con ese nombre', 409);
  }
}

async function createTipoCena(db, body) {
  const nombre = parseNombre(body.nombre);
  const precioAlojado = parsePrecio(body.precioAlojado ?? 0, 'Precio alojado');
  const precioExterno = parsePrecio(body.precioExterno ?? 0, 'Precio externo');
  await assertNombreLibre(db, nombre);
  const last = await db.menuItem.findFirst({
    where: { category: CENAS_CATEGORY },
    orderBy: { ordenIndex: 'desc' },
    select: { ordenIndex: true }
  });
  const item = await db.menuItem.create({
    data: {
      category: CENAS_CATEGORY,
      name: nombre,
      price: 0,
      isActive: true,
      ordenIndex: (last?.ordenIndex ?? 0) + 10,
      varieties: {
        create: [
          { name: VARIEDAD.ALOJADO, price: precioAlojado, ordenIndex: 0 },
          { name: VARIEDAD.EXTERNO, price: precioExterno, ordenIndex: 1 }
        ]
      }
    },
    include: TIPO_INCLUDE
  });
  return tipoView(item);
}

async function findTipo(db, id) {
  const item = await db.menuItem.findFirst({
    where: { id, category: CENAS_CATEGORY },
    include: TIPO_INCLUDE
  });
  if (!item) throw new CenaInputError('Tipo de cena no encontrado', 404);
  return item;
}

async function updateTipoCena(db, id, body) {
  const item = await findTipo(db, id);
  const data = {};
  if (body.nombre !== undefined) {
    data.name = parseNombre(body.nombre);
    await assertNombreLibre(db, data.name, id);
  }
  if (body.activo !== undefined) data.isActive = Boolean(body.activo);
  if (body.ordenIndex !== undefined) {
    const n = Number(body.ordenIndex);
    if (!Number.isInteger(n)) throw new CenaInputError('Orden inválido');
    data.ordenIndex = n;
  }
  const precios = [
    [VARIEDAD.ALOJADO, parsePrecio(body.precioAlojado, 'Precio alojado'), 0],
    [VARIEDAD.EXTERNO, parsePrecio(body.precioExterno, 'Precio externo'), 1]
  ];

  await db.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.menuItem.update({ where: { id }, data });
    for (const [name, price, ordenIndex] of precios) {
      if (price === undefined) continue;
      const existing = varietyOf(item, name);
      if (existing) await tx.menuItemVariety.update({ where: { id: existing.id }, data: { price } });
      else await tx.menuItemVariety.create({ data: { menuItemId: id, name, price, ordenIndex } });
    }
  });
  return tipoView(await findTipo(db, id));
}

/** Borra un tipo nunca usado; si ya tiene ventas, hay que desactivarlo. */
async function deleteTipoCena(db, id) {
  const item = await findTipo(db, id);
  if ((item._count?.comandaItems || 0) > 0) {
    throw new CenaInputError(
      'Este tipo de cena ya se usó en comandas; desactivalo en lugar de eliminarlo',
      409
    );
  }
  await db.menuItem.delete({ where: { id } });
}

/** Variedad (Alojado / Externo) de un tipo de cena activo, para cargar una cena. */
async function resolveCenaVariety(db, menuItemId, variedad) {
  const item = await db.menuItem.findFirst({
    where: { id: menuItemId, category: CENAS_CATEGORY, isActive: true },
    include: { varieties: true }
  });
  if (!item) throw new CenaInputError('Tipo de cena inválido o inactivo');
  const name = variedad === 'EXTERNO' ? VARIEDAD.EXTERNO : VARIEDAD.ALOJADO;
  const variety = varietyOf(item, name);
  if (!variety) throw new CenaInputError(`El tipo de cena no tiene precio ${name.toLowerCase()}`);
  return { item, variety };
}

module.exports = {
  CENAS_CATEGORY,
  VARIEDAD,
  CenaInputError,
  listTiposCena,
  createTipoCena,
  updateTipoCena,
  deleteTipoCena,
  resolveCenaVariety
};
