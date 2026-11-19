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
  const [cargos, imputaciones, discounts] = await Promise.all([
    db.cargo.findMany({ where: { accountId }, select: { monto: true } }),
    // Crédito de folio = imputaciones (no Pago.montoARS directo; evita doble conteo multi).
    db.pagoImputacion.findMany({ where: { accountId }, select: { montoARS: true } }),
    db.discountApplication.findMany({ where: { accountId }, select: { montoARS: true } })
  ]);
  const pagos = imputaciones;
  return { cargos, pagos, discounts, balance: calculateAccountBalance(cargos, pagos, discounts) };
}

async function buildSettlementContext(db, {
  config,
  motivo,
  dineroARS,
  saldoPendienteAntes,
  accountId,
  selectedRuleIds,
  deselectedRuleIds,
  benefitValueByRuleId,
  applySuggestedDefaults,
  applyAutomatics,
  mode
}) {
  let nights = null;
  let checkIn = null;
  let checkOut = null;
  let roomTypeId = null;
  let serviceTypeId = null;
  let hotelId = null;
  let occupancyPercent = null;
  let reservationDate = null;

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
    if (reservation) {
      reservationDate = reservation.createdAt || null;
      if (reservation.segments?.length) {
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
    reservationDate,
    createdAt: reservationDate,
    checkIn,
    checkOut,
    roomTypeId,
    serviceTypeId,
    hotelId,
    occupancyPercent,
    selectedRuleIds: selectedRuleIds || [],
    deselectedRuleIds: Array.isArray(deselectedRuleIds) ? deselectedRuleIds : [],
    // Paridad con Consulta/RATE: SUGERIDA (opcional default ON) aplica salvo deselection.
    applySuggestedDefaults:
      applySuggestedDefaults != null ? Boolean(applySuggestedDefaults) : true,
    applyAutomatics: applyAutomatics != null ? Boolean(applyAutomatics) : true,
    benefitValueByRuleId: benefitValueByRuleId || {},
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
  deselectedRuleIds,
  benefitValueByRuleId,
  applySuggestedDefaults,
  applyAutomatics,
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
      deselectedRuleIds,
      benefitValueByRuleId,
      applySuggestedDefaults,
      applyAutomatics,
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
  pagoImputacionId = null,
  config,
  motivo,
  dineroARS,
  monedaPago,
  tipoCambio,
  saldoPendienteAntes,
  selectedRuleIds,
  deselectedRuleIds,
  benefitValueByRuleId,
  applySuggestedDefaults,
  applyAutomatics,
  /** Si se pasa, no recalcula: usa este monto de bono (multi-prorrateo). */
  descuentoARSOverride = null
}) {
  if (!config && !(selectedRuleIds && selectedRuleIds.length) && descuentoARSOverride == null) {
    return null;
  }

  let descuentoARS;
  let porcentaje = null;
  let valorFijo = null;
  let appliedRules = null;
  let promotionRuleId = null;

  if (descuentoARSOverride != null) {
    descuentoARS = roundMoney(Math.max(0, toNumber(descuentoARSOverride)));
    if (descuentoARS <= 0) return null;
  } else {
    const resolved = await resolveSettlementDiscount(db, {
      config,
      motivo,
      dineroARS,
      saldoPendienteAntes,
      accountId,
      selectedRuleIds,
      deselectedRuleIds,
      benefitValueByRuleId,
      applySuggestedDefaults,
      applyAutomatics,
      mode: 'received'
    });

    if (!resolved.aplica || resolved.descuentoARS <= 0) {
      return null;
    }
    descuentoARS = resolved.descuentoARS;
    porcentaje = resolved.porcentaje;
    valorFijo = resolved.valorFijo;
    appliedRules = resolved.appliedRules || null;
    promotionRuleId = resolved.promotionRuleId || resolved.appliedRules?.[0]?.promotionRuleId || null;
  }

  const tipo =
    promotionRuleId != null
      ? 'PROMOTION'
      : selectedRuleIds?.length
        ? 'MANUAL'
        : 'PAYMENT_METHOD';

  return db.discountApplication.create({
    data: {
      accountId,
      pagoId,
      pagoImputacionId: pagoImputacionId != null ? Number(pagoImputacionId) : null,
      paymentMethodConfigId: config?.id ?? null,
      promotionRuleId,
      tipo,
      baseCalculoARS: new Decimal(roundMoney(dineroARS)),
      porcentaje: porcentaje != null ? new Decimal(porcentaje) : null,
      valorFijo: valorFijo != null ? new Decimal(valorFijo) : null,
      montoARS: new Decimal(descuentoARS),
      monedaPago: monedaPago || 'ARS',
      tipoCambio:
        tipoCambio != null && Number(tipoCambio) > 0 ? new Decimal(tipoCambio) : null,
      appliedRulesJson: appliedRules,
      activo: true,
      notas: appliedRules?.map((r) => r.code).filter(Boolean).join(',') || null
    }
  });
}

/**
 * Valida y prepara reversión de descuento para una devolución ligada a pago origen.
 */
async function createReversalDiscount(db, {
  accountId,
  devolucionPagoId,
  devolucionImputacionId = null,
  pagoOrigen,
  devolucionMontoARSAbs,
  /** Imputación origen (multi); si null, toma DA forward del account o del pago. */
  pagoOrigenImputacionId = null
}) {
  const original = await db.discountApplication.findFirst({
    where: {
      pagoId: pagoOrigen.id,
      tipo: { not: 'REVERSAL' },
      montoARS: { gt: 0 },
      ...(pagoOrigenImputacionId != null
        ? { pagoImputacionId: Number(pagoOrigenImputacionId) }
        : { accountId: Number(accountId) })
    },
    orderBy: { id: 'asc' }
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

  const origenMonto =
    pagoOrigenImputacionId != null
      ? (
          await db.pagoImputacion.findUnique({
            where: { id: Number(pagoOrigenImputacionId) },
            select: { montoARS: true }
          })
        )?.montoARS ?? pagoOrigen.montoARS
      : pagoOrigen.montoARS;

  const { descuentoRevertidoARS } = computeDiscountReversal({
    originalDiscountARS: toNumber(original.montoARS),
    originalPagoARS: origenMonto,
    devolucionARS: devolucionMontoARSAbs
  });

  const revertAmount = roundMoney(Math.min(remaining, descuentoRevertidoARS));
  if (revertAmount <= 0) return null;

  const reversal = await db.discountApplication.create({
    data: {
      accountId,
      pagoId: devolucionPagoId,
      pagoImputacionId:
        devolucionImputacionId != null ? Number(devolucionImputacionId) : null,
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
