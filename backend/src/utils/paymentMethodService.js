/**
 * Resolución de PaymentMethodConfig + aplicación/reversión de DiscountApplication.
 */

const { Decimal } = require('@prisma/client/runtime/library');
const {
  computeDiscountFromReceived,
  computeDiscountReversal,
  roundMoney,
  toNumber
} = require('./paymentDiscount');
const { calculateAccountBalance } = require('./reservationBalance');

function normalizeLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

async function resolvePaymentMethodConfig(db, { paymentMethodConfigId, metodo } = {}) {
  if (paymentMethodConfigId != null) {
    const id = parseInt(paymentMethodConfigId, 10);
    if (Number.isFinite(id)) {
      const byId = await db.paymentMethodConfig.findUnique({ where: { id } });
      if (byId) return byId;
    }
  }
  if (metodo) {
    const label = String(metodo).trim();
    const all = await db.paymentMethodConfig.findMany({ orderBy: { ordenIndex: 'asc' } });
    const needle = normalizeLabel(label);
    return (
      all.find((c) => normalizeLabel(c.label) === needle) ||
      all.find((c) => normalizeLabel(c.code) === needle) ||
      null
    );
  }
  return null;
}

async function loadAccountFinancialParts(db, accountId) {
  const [cargos, pagos, discounts] = await Promise.all([
    db.cargo.findMany({ where: { accountId }, select: { monto: true } }),
    db.pago.findMany({ where: { accountId }, select: { montoARS: true } }),
    db.discountApplication.findMany({ where: { accountId }, select: { montoARS: true } })
  ]);
  return { cargos, pagos, discounts, balance: calculateAccountBalance(cargos, pagos, discounts) };
}

/**
 * Crea DiscountApplication forward si el medio aplica.
 * @returns {Promise<object|null>}
 */
async function createForwardDiscount(db, {
  accountId,
  pagoId,
  config,
  motivo,
  dineroARS,
  monedaPago,
  tipoCambio,
  saldoPendienteAntes
}) {
  if (!config) return null;

  const preview = computeDiscountFromReceived({
    dineroARS,
    config,
    motivo,
    saldoPendiente: saldoPendienteAntes
  });

  if (!preview.aplica || preview.descuentoARS <= 0) {
    return null;
  }

  return db.discountApplication.create({
    data: {
      accountId,
      pagoId,
      paymentMethodConfigId: config.id,
      tipo: 'PAYMENT_METHOD',
      baseCalculoARS: new Decimal(roundMoney(dineroARS)),
      porcentaje: preview.porcentaje != null ? new Decimal(preview.porcentaje) : null,
      valorFijo: null,
      montoARS: new Decimal(preview.descuentoARS),
      monedaPago: monedaPago || 'ARS',
      tipoCambio:
        tipoCambio != null && Number(tipoCambio) > 0 ? new Decimal(tipoCambio) : null,
      activo: true,
      notas: null
    }
  });
}

/**
 * Valida y prepara reversión de descuento para una devolución ligada a pago origen.
 */
async function createReversalDiscount(db, {
  accountId,
  devolucionPagoId,
  pagoOrigen,
  devolucionMontoARSAbs
}) {
  const original = await db.discountApplication.findUnique({
    where: { pagoId: pagoOrigen.id }
  });
  if (!original || !original.activo || toNumber(original.montoARS) <= 0) {
    return null;
  }

  // Ya revertido completamente (hay reversión(es) que cubren el monto)
  const priorReversals = await db.discountApplication.findMany({
    where: { reversoDeId: original.id },
    select: { montoARS: true }
  });
  const alreadyReversed = priorReversals.reduce(
    (sum, r) => sum + Math.abs(toNumber(r.montoARS)),
    0
  );
  const remaining = roundMoney(toNumber(original.montoARS) - alreadyReversed);
  if (remaining <= 0) {
    return null;
  }

  const { descuentoRevertidoARS } = computeDiscountReversal({
    originalDiscountARS: toNumber(original.montoARS),
    originalPagoARS: pagoOrigen.montoARS,
    devolucionARS: devolucionMontoARSAbs
  });

  const revertAmount = roundMoney(Math.min(remaining, descuentoRevertidoARS));
  if (revertAmount <= 0) return null;

  const reversal = await db.discountApplication.create({
    data: {
      accountId,
      pagoId: devolucionPagoId,
      paymentMethodConfigId: original.paymentMethodConfigId,
      tipo: 'REVERSAL',
      baseCalculoARS: new Decimal(roundMoney(devolucionMontoARSAbs)),
      porcentaje: original.porcentaje,
      valorFijo: original.valorFijo,
      montoARS: new Decimal(-revertAmount),
      monedaPago: original.monedaPago,
      tipoCambio: original.tipoCambio,
      reversoDeId: original.id,
      activo: true,
      notas: `Reversión de descuento #${original.id}`
    }
  });

  const newRemaining = roundMoney(remaining - revertAmount);
  if (newRemaining <= 0.009) {
    await db.discountApplication.update({
      where: { id: original.id },
      data: { activo: false }
    });
  }

  return reversal;
}

/**
 * Suma de montos (abs) ya devueltos sobre un pago origen.
 */
async function sumDevolucionesOnOrigen(db, pagoOrigenId) {
  const rows = await db.pago.findMany({
    where: { pagoOrigenId, motivo: 'Devolución' },
    select: { montoARS: true }
  });
  return roundMoney(rows.reduce((s, r) => s + Math.abs(toNumber(r.montoARS)), 0));
}

module.exports = {
  normalizeLabel,
  resolvePaymentMethodConfig,
  loadAccountFinancialParts,
  createForwardDiscount,
  createReversalDiscount,
  sumDevolucionesOnOrigen
};
