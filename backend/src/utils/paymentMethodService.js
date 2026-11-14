/**
 * Resolución de PaymentMethodConfig + aplicación/reversión de DiscountApplication
 * vía motor de PromotionRule (fuente de verdad; mirror legacy en PaymentMethodConfig).
 */

const { Decimal } = require('@prisma/client/runtime/library');
const {
  computeDiscountFromReceived,
  computeDiscountReversal,
  roundMoney,
  toNumber
} = require('./paymentDiscount');
const { calculateAccountBalance } = require('./reservationBalance');
const {
  loadActivePromotionRules,
  evaluateSettlementRules,
  computeHotelOccupancyPercent,
  civilDaysBetween
} = require('./promotionEngine');

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

async function buildSettlementContext(db, {
  config,
  motivo,
  dineroARS,
  saldoPendienteAntes,
  accountId,
  selectedRuleIds,
  mode
}) {
  let nights = null;
  let checkIn = null;
  let checkOut = null;
  let roomTypeId = null;
  let serviceTypeId = null;
  let hotelId = null;
  let occupancyPercent = null;

  if (accountId) {
    const account = await db.account.findUnique({
      where: { id: accountId },
      include: {
        reservation: {
          include: {
            segments: {
              orderBy: { startDate: 'asc' },
              include: { room: true }
            }
          }
        }
      }
    });
    const reservation = account?.reservation;
    if (reservation?.segments?.length) {
      const first = reservation.segments[0];
      const last = reservation.segments[reservation.segments.length - 1];
      checkIn = first.startDate;
      checkOut = last.endDate;
      nights = civilDaysBetween(checkIn, checkOut);
      roomTypeId = first.roomTypeId || first.room?.roomTypeId || null;
      serviceTypeId =
        first.services && first.services.length ? first.services[0] : first.serviceTypeId || null;
      hotelId = first.room?.hotelId || reservation.hotelId || null;
    }
  }

  try {
    occupancyPercent = await computeHotelOccupancyPercent(db, {
      hotelId,
      date: checkIn || new Date()
    });
  } catch {
    occupancyPercent = null;
  }

  return {
    layer: 'SETTLEMENT',
    asOfDate: new Date(),
    motivo: motivo || 'Pago',
    dineroARS,
    saldoPendiente: saldoPendienteAntes,
    paymentMethodConfigId: config?.id ?? null,
    paymentMethodCode: config?.code ?? null,
    nights,
    checkIn,
    checkOut,
    roomTypeId,
    serviceTypeId,
    hotelId,
    occupancyPercent,
    selectedRuleIds: selectedRuleIds || [],
    mode: mode || 'received'
  };
}

/**
 * Resuelve descuento settlement desde PromotionRule; fallback mirror PaymentMethodConfig.
 */
async function resolveSettlementDiscount(db, {
  config,
  motivo,
  dineroARS,
  saldoPendienteAntes,
  accountId,
  selectedRuleIds,
  mode = 'received'
}) {
  let rules = [];
  try {
    rules = await loadActivePromotionRules(db, { layer: 'SETTLEMENT' });
  } catch (err) {
    // Tabla aún no migrada: fallback legacy
    if (err.code !== 'P2021' && !/PromotionRule/i.test(String(err.message || ''))) {
      throw err;
    }
  }

  if (rules.length) {
    const ctx = await buildSettlementContext(db, {
      config,
      motivo,
      dineroARS,
      saldoPendienteAntes,
      accountId,
      selectedRuleIds,
      mode
    });
    const evaluated = evaluateSettlementRules(rules, ctx);
    if (evaluated.aplica || evaluated.selectedRules?.length) {
      return evaluated;
    }
    // Sin match de reglas: no aplicar mirror legacy (hardcode apagado si hay motor)
    return {
      ...evaluated,
      aplica: false,
      descuentoARS: 0,
      creditoARS: roundMoney(toNumber(dineroARS || saldoPendienteAntes || 0)),
      dineroARS: roundMoney(toNumber(dineroARS || saldoPendienteAntes || 0))
    };
  }

  // Fallback pre-migración / sin reglas
  const preview = computeDiscountFromReceived({
    dineroARS,
    config,
    motivo,
    saldoPendiente: saldoPendienteAntes
  });
  return {
    ...preview,
    selectedRules: [],
    suggestions: [],
    appliedRules: preview.aplica
      ? [
          {
            promotionRuleId: null,
            code: config?.code || 'LEGACY',
            label: config?.label || 'Legacy medio',
            montoARS: preview.descuentoARS,
            porcentaje: preview.porcentaje
          }
        ]
      : [],
    promotionRuleId: null,
    config
  };
}

/**
 * Crea DiscountApplication forward si el motor / medio aplica.
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
  saldoPendienteAntes,
  selectedRuleIds
}) {
  if (!config && !(selectedRuleIds && selectedRuleIds.length)) return null;

  const resolved = await resolveSettlementDiscount(db, {
    config,
    motivo,
    dineroARS,
    saldoPendienteAntes,
    accountId,
    selectedRuleIds,
    mode: 'received'
  });

  if (!resolved.aplica || resolved.descuentoARS <= 0) {
    return null;
  }

  const primaryRuleId = resolved.promotionRuleId || resolved.appliedRules?.[0]?.promotionRuleId || null;
  const tipo =
    primaryRuleId != null
      ? 'PROMOTION'
      : selectedRuleIds?.length
        ? 'MANUAL'
        : 'PAYMENT_METHOD';

  return db.discountApplication.create({
    data: {
      accountId,
      pagoId,
      paymentMethodConfigId: config?.id ?? null,
      promotionRuleId: primaryRuleId,
      tipo,
      baseCalculoARS: new Decimal(roundMoney(dineroARS)),
      porcentaje: resolved.porcentaje != null ? new Decimal(resolved.porcentaje) : null,
      valorFijo: resolved.valorFijo != null ? new Decimal(resolved.valorFijo) : null,
      montoARS: new Decimal(resolved.descuentoARS),
      monedaPago: monedaPago || 'ARS',
      tipoCambio:
        tipoCambio != null && Number(tipoCambio) > 0 ? new Decimal(tipoCambio) : null,
      appliedRulesJson: resolved.appliedRules || null,
      activo: true,
      notas: resolved.appliedRules?.map((r) => r.code).filter(Boolean).join(',') || null
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
      promotionRuleId: original.promotionRuleId,
      tipo: 'REVERSAL',
      baseCalculoARS: new Decimal(roundMoney(devolucionMontoARSAbs)),
      porcentaje: original.porcentaje,
      valorFijo: original.valorFijo,
      montoARS: new Decimal(-revertAmount),
      monedaPago: original.monedaPago,
      tipoCambio: original.tipoCambio,
      appliedRulesJson: original.appliedRulesJson || null,
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

/**
 * Preview público (API / PaymentForm enrichment).
 */
async function previewSettlementDiscount(db, params) {
  return resolveSettlementDiscount(db, params);
}

module.exports = {
  normalizeLabel,
  resolvePaymentMethodConfig,
  loadAccountFinancialParts,
  createForwardDiscount,
  createReversalDiscount,
  sumDevolucionesOnOrigen,
  resolveSettlementDiscount,
  previewSettlementDiscount,
  buildSettlementContext
};
