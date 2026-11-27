/**
 * Cobros anulados: quedan en la tabla (código, monto, factura, adjuntos, quién/cuándo/por qué)
 * pero no son dinero vigente.
 *
 * - Al anular se borran sus imputaciones y descuentos y se desvincula de cuenta/reserva
 *   (`anularCobro`), así no aparecen en saldos ni en `include` por relación.
 * - Las lecturas directas de Cobro (caja, historial, conteos) los excluyen con esta extensión
 *   de Prisma. Para incluirlos a propósito, poner la clave `anuladoAt` en el `where`
 *   (p. ej. `{ anuladoAt: { not: null } }` o `{ anuladoAt: undefined }` para todos).
 *   `findUnique` no se filtra (ver el detalle de un cobro anulado).
 */

const FILTERED_OPERATIONS = ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'];

function withoutAnulados(args = {}) {
  const where = args.where || {};
  if (Object.prototype.hasOwnProperty.call(where, 'anuladoAt')) return args;
  return { ...args, where: { ...where, anuladoAt: null } };
}

function createCobrosAnuladosExtension() {
  const handlers = {};
  for (const op of FILTERED_OPERATIONS) {
    handlers[op] = ({ args, query }) => query(withoutAnulados(args));
  }
  return { name: 'rivieraCobrosAnulados', query: { cobro: handlers } };
}

/**
 * Anula un cobro dentro de una transacción. Devuelve los accountIds afectados (para recalcular estado).
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ cobroId: number, user?: { id?: number, displayName?: string, username?: string }, motivo?: string|null, now?: Date }} params
 */
async function anularCobro(tx, { cobroId, user, motivo, now = new Date() }) {
  const cobro = await tx.cobro.findUnique({
    where: { id: cobroId },
    include: { imputaciones: true, discountApplications: true }
  });
  if (!cobro) {
    throw Object.assign(new Error('Cobro no encontrado'), { statusCode: 404 });
  }
  if (cobro.anuladoAt) {
    throw Object.assign(new Error(`El cobro ${cobro.codigo} ya está anulado`), { statusCode: 400 });
  }
  const devolucionesActivas = await tx.cobro.count({ where: { cobroOrigenId: cobro.id } });
  if (devolucionesActivas > 0) {
    throw Object.assign(
      new Error('No se puede anular: tiene devoluciones vinculadas. Anulá primero las devoluciones.'),
      { statusCode: 400 }
    );
  }

  const accountIds = [
    ...new Set([cobro.accountId, ...cobro.imputaciones.map((i) => i.accountId)].filter(Boolean))
  ];

  const snapshot = {
    accountId: cobro.accountId,
    reservaId: cobro.reservaId,
    imputaciones: cobro.imputaciones.map((i) => ({
      accountId: i.accountId,
      reservaId: i.reservaId,
      montoARS: String(i.montoARS),
      bonificacionARS: String(i.bonificacionARS)
    })),
    discountApplications: cobro.discountApplications.map((d) => ({
      id: d.id,
      accountId: d.accountId,
      montoARS: String(d.montoARS),
      promotionRuleId: d.promotionRuleId ?? null,
      paymentMethodConfigId: d.paymentMethodConfigId ?? null
    }))
  };

  await tx.discountApplication.deleteMany({ where: { cobroId: cobro.id } });
  await tx.cobroImputacion.deleteMany({ where: { cobroId: cobro.id } });
  const updated = await tx.cobro.update({
    where: { id: cobro.id },
    data: {
      anuladoAt: now,
      anuladoPorId: user?.id ?? null,
      anuladoPorNombre: user?.displayName || user?.username || null,
      motivoAnulacion: motivo ? String(motivo).trim() || null : null,
      anulacionSnapshot: snapshot,
      accountId: null,
      reservaId: null
    }
  });

  return { cobro: updated, accountIds };
}

module.exports = {
  createCobrosAnuladosExtension,
  withoutAnulados,
  anularCobro
};
