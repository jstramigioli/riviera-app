/**
 * Comandas de consumo: ámbito, armado de líneas con precio histórico y
 * mantenimiento de la comanda cuando se quitan cargos.
 *
 * Una comanda agrupa líneas cargadas juntas sobre una Account. Cada línea con
 * cargo genera un Cargo (mecanismo económico único); la línea guarda copia del
 * precio para conservar el histórico aunque cambie el catálogo.
 */
const { Decimal } = require('@prisma/client/runtime/library');
const { syncAccountStatusFromBalance } = require('./accountHelpers');
const { calculateAccountBalance } = require('./accountBalance');

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
