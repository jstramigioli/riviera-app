/**
 * Comandas de consumo: ámbito, armado de líneas con precio histórico y
 * mantenimiento de la comanda cuando se quitan cargos.
 *
 * Una comanda agrupa líneas cargadas juntas sobre una Account. Cada línea con
 * cargo genera un Cargo (mecanismo económico único); la línea guarda copia del
 * precio para conservar el histórico aunque cambie el catálogo.
 */
const { Decimal } = require('@prisma/client/runtime/library');
const {
  syncAccountStatusFromBalance,
  dualWriteReservationRefs,
  dualWriteExternalRefs
} = require('./accountHelpers');
const { calculateAccountBalance } = require('./accountBalance');
const { consumirBeneficio, liberarBeneficioDeComanda } = require('./beneficios');

const AMBITOS_CONSUMO = ['CENA', 'MINUTAS', 'CAFETERIA', 'FRIGOBAR'];

const AMBITO_LABELS = {
  CENA: 'Cena',
  MINUTAS: 'Minutas',
  CAFETERIA: 'Cafetería',
  FRIGOBAR: 'Frigobar'
};

/** Devuelve el código de ámbito válido (mayúsculas) o null. */
function parseAmbito(value) {
  if (value == null) return null;
  const code = String(value).trim().toUpperCase();
  return AMBITOS_CONSUMO.includes(code) ? code : null;
}

/** Texto del cargo: «Producto (Variedad)» y « xN» si la cantidad es > 1. */
function lineDescription(itemName, varietyName, quantity) {
  const label = varietyName ? `${itemName} (${varietyName})` : itemName;
  return quantity === 1 ? label : `${label} x${quantity}`;
}

/**
 * Arma las líneas de comanda a partir de los ítems normalizados
 * ({ menuItemId, quantity, variety? }) y el catálogo vigente.
 * El precio unitario se toma de la variedad si la hay.
 */
function buildComandaLines(normalized, menuById) {
  return normalized.map((row) => {
    const item = menuById.get(row.menuItemId);
    const variety = row.variety || null;
    const precioUnitario = new Decimal(variety ? variety.price : item.price);
    const cantidad = row.quantity;
    return {
      menuItemId: item.id,
      varietyId: variety ? variety.id : null,
      category: item.category,
      descripcion: lineDescription(item.name, variety ? variety.name : null, cantidad),
      cantidad,
      precioUnitario,
      subtotal: precioUnitario.mul(cantidad)
    };
  });
}

/** Error de validación de ítems de comanda (→ HTTP 400). */
class ComandaInputError extends Error {}

const GROUP_LABELS = {
  BEBIDAS: 'Bebidas',
  MINUTAS: 'Minutas',
  CAFETERIA: 'Cafetería',
  CENAS: 'Cenas'
};

/**
 * Valida los ítems pedidos ({ menuItemId, quantity, varietyId? }) contra el
 * catálogo activo y arma las líneas con precio vigente.
 * Lanza ComandaInputError con un mensaje para el usuario.
 */
async function resolveOrderItems(db, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ComandaInputError('Agregá al menos un ítem');
  }
  const normalized = [];
  for (const row of rawItems) {
    const menuItemId = Number(row.menuItemId);
    const quantity = Number(row.quantity);
    const varietyIdRaw = row.varietyId ?? row.menuItemVarietyId;
    const varietyId = varietyIdRaw == null || varietyIdRaw === '' ? null : Number(varietyIdRaw);
    if (!Number.isFinite(menuItemId) || !Number.isFinite(quantity) || quantity <= 0) {
      throw new ComandaInputError('Cada ítem necesita menuItemId y quantity > 0');
    }
    if (varietyIdRaw != null && varietyIdRaw !== '' && !Number.isFinite(varietyId)) {
      throw new ComandaInputError('varietyId inválido');
    }
    normalized.push({ menuItemId, varietyId, quantity: Math.min(999, Math.floor(quantity)) });
  }

  const menuIds = [...new Set(normalized.map((i) => i.menuItemId))];
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: menuIds }, isActive: true },
    include: { varieties: { orderBy: [{ ordenIndex: 'asc' }, { name: 'asc' }] } }
  });
  if (menuItems.length !== menuIds.length) {
    throw new ComandaInputError('Uno o más ítems del menú no existen o están inactivos');
  }
  const menuById = new Map(menuItems.map((m) => [m.id, m]));

  for (const row of normalized) {
    const item = menuById.get(row.menuItemId);
    const varieties = item.varieties || [];
    if (varieties.length > 0) {
      if (row.varietyId == null) {
        throw new ComandaInputError(
          `Elegí variedad para “${item.name}” (${varieties.map((v) => v.name).join(' / ')})`
        );
      }
      const variety = varieties.find((v) => v.id === row.varietyId);
      if (!variety) throw new ComandaInputError(`Variedad inválida para “${item.name}”`);
      row.variety = variety;
    } else if (row.varietyId != null) {
      throw new ComandaInputError(`“${item.name}” no tiene variedades`);
    }
  }

  const categories = [...new Set(menuItems.map((m) => m.category))];
  const subcats = await db.subcategoriaCargo.findMany({
    where: { tipo: 'CONSUMO', codigo: { in: categories }, esActivo: true }
  });
  const subcatByCode = new Map(subcats.map((sc) => [sc.codigo, sc]));
  for (const code of categories) {
    if (!subcatByCode.has(code)) {
      throw new ComandaInputError(
        `Falta subcategoría de consumo ${GROUP_LABELS[code] || code}. Configurala en Cargos.`
      );
    }
  }

  return { lines: buildComandaLines(normalized, menuById), subcatByCode };
}

/** Referencias financieras (dual-write) para crear cargos en la cuenta. */
function financialRefsForAccount(account) {
  return account.kind === 'RESERVATION'
    ? dualWriteReservationRefs(account, account.reservationId)
    : dualWriteExternalRefs(account);
}

/**
 * Agrega líneas a una comanda: un Cargo por línea (con subcategoría del grupo
 * del producto, nunca null) + la línea con su precio. Las líneas bonificadas
 * (Almuerzo sin cargo) no generan Cargo. Devuelve los cargos.
 */
async function addLinesToComanda(tx, { comanda, account, lines, subcatByCode, notas = null }) {
  const financialRefs = financialRefsForAccount(account);
  const cargos = [];
  for (const line of lines) {
    if (line.bonificado) {
      await tx.comandaItem.create({
        data: {
          comandaId: comanda.id,
          menuItemId: line.menuItemId,
          varietyId: line.varietyId,
          descripcion: line.descripcion,
          cantidad: line.cantidad,
          precioUnitario: line.precioUnitario,
          subtotal: line.subtotal,
          bonificado: true
        }
      });
      continue;
    }
    const sub = subcatByCode.get(line.category);
    const cargo = await tx.cargo.create({
      data: {
        ...financialRefs,
        subcategoriaCargoId: sub.id,
        descripcion: line.descripcion,
        monto: line.subtotal,
        notas,
        fecha: comanda.fecha
      },
      include: { subcategoriaCargo: true }
    });
    const item = await tx.comandaItem.create({
      data: {
        comandaId: comanda.id,
        menuItemId: line.menuItemId,
        varietyId: line.varietyId,
        descripcion: line.descripcion,
        cantidad: line.cantidad,
        precioUnitario: line.precioUnitario,
        subtotal: line.subtotal,
        cargoId: cargo.id
      }
    });
    cargos.push({
      ...cargo,
      comandaId: comanda.id,
      comandaItemId: item.id,
      menuItemId: line.menuItemId,
      varietyId: line.varietyId,
      quantity: line.cantidad,
      unitPrice: line.precioUnitario
    });
  }
  await refreshAccountStatus(tx, account.id);
  return cargos;
}

/**
 * Crea una comanda con sus líneas y cargos. fecha: Date (día civil UTC).
 * beneficioId: Almuerzo sin cargo ya validado (líneas con `bonificado`); se consume acá.
 */
async function createComanda(
  tx,
  { ambito, fecha, account, notas = null, lines, subcatByCode, beneficioId = null }
) {
  const comanda = await tx.comanda.create({
    data: {
      ambito,
      fecha,
      accountId: account.id,
      reservationId: account.reservationId ?? null,
      notas
    }
  });
  const cargos = await addLinesToComanda(tx, { comanda, account, lines, subcatByCode, notas });
  if (beneficioId) await consumirBeneficio(tx, beneficioId, comanda.id);
  return { comanda, cargos };
}

/** Recalcula saldo de la cuenta y actualiza su estado OPEN/CLOSED. */
async function refreshAccountStatus(tx, accountId) {
  const [cargos, cobros, discounts] = await Promise.all([
    tx.cargo.findMany({ where: { accountId }, select: { monto: true } }),
    tx.cobro.findMany({ where: { accountId }, select: { montoARS: true } }),
    tx.discountApplication.findMany({ where: { accountId }, select: { montoARS: true } })
  ]);
  const { saldo } = calculateAccountBalance(cargos, cobros, discounts);
  await syncAccountStatusFromBalance(tx, accountId, saldo);
  return saldo;
}

/**
 * Anula una comanda: borra sus cargos (baja la deuda) y conserva comanda y
 * líneas como registro. Idempotente.
 */
async function anularComanda(tx, comandaId) {
  const comanda = await tx.comanda.findUnique({
    where: { id: comandaId },
    include: { items: { select: { id: true, cargoId: true } } }
  });
  if (!comanda) return null;
  if (comanda.estado === 'ANULADA') return comanda;

  const cargoIds = comanda.items.map((i) => i.cargoId).filter((id) => id != null);
  if (cargoIds.length > 0) {
    await tx.cargo.deleteMany({ where: { id: { in: cargoIds } } });
  }
  const updated = await tx.comanda.update({
    where: { id: comandaId },
    data: { estado: 'ANULADA', anuladaAt: new Date() }
  });
  // Si usó un Almuerzo sin cargo, el beneficio vuelve a estar disponible.
  await liberarBeneficioDeComanda(tx, comandaId);
  await refreshAccountStatus(tx, comanda.accountId);
  return updated;
}

/**
 * Quita de su comanda la línea asociada a un cargo que se está eliminando.
 * Si la comanda queda sin líneas, pasa a ANULADA. Devuelve la comanda o null
 * si el cargo no pertenecía a ninguna.
 */
async function removeComandaLineForCargo(tx, cargoId) {
  const line = await tx.comandaItem.findUnique({
    where: { cargoId },
    select: { id: true, comandaId: true }
  });
  if (!line) return null;

  await tx.comandaItem.delete({ where: { id: line.id } });
  const remaining = await tx.comandaItem.count({ where: { comandaId: line.comandaId } });
  if (remaining === 0) {
    return tx.comanda.update({
      where: { id: line.comandaId },
      data: { estado: 'ANULADA', anuladaAt: new Date() }
    });
  }
  return tx.comanda.findUnique({ where: { id: line.comandaId } });
}

/** Include Prisma para mostrar a qué comanda pertenece un cargo. */
const CARGO_COMANDA_INCLUDE = {
  comandaItem: {
    select: {
      id: true,
      cantidad: true,
      precioUnitario: true,
      comanda: { select: { id: true, ambito: true, estado: true, fecha: true } }
    }
  }
};

module.exports = {
  ComandaInputError,
  resolveOrderItems,
  financialRefsForAccount,
  addLinesToComanda,
  createComanda,
  AMBITOS_CONSUMO,
  AMBITO_LABELS,
  parseAmbito,
  lineDescription,
  buildComandaLines,
  refreshAccountStatus,
  anularComanda,
  removeComandaLineForCargo,
  CARGO_COMANDA_INCLUDE
};
