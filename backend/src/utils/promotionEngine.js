/**
 * Motor de reglas de promociones / descuentos.
 * Condiciones AND → beneficio → modalidad (AUTO|MANUAL|SUGERIDA) → capa (SETTLEMENT|RATE).
 * Snapshot en DiscountApplication / ReservationNightRate; solo forward.
 */

const {
  roundMoney,
  toNumber,
  rateFromPercent,
  computeDiscountFromReceived,
  computeCashToSettle
} = require('./paymentDiscount');

function toDateOnlyString(date) {
  if (!date) return null;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.slice(0, 10);
  }
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function civilDaysBetween(checkIn, checkOut) {
  const a = toDateOnlyString(checkIn);
  const b = toDateOnlyString(checkOut);
  if (!a || !b) return null;
  const t0 = Date.parse(`${a}T12:00:00.000Z`);
  const t1 = Date.parse(`${b}T12:00:00.000Z`);
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  return Math.max(0, Math.round((t1 - t0) / 86400000));
}

function parseParams(params) {
  if (params == null) return {};
  if (typeof params === 'string') {
    try {
      return JSON.parse(params);
    } catch {
      return {};
    }
  }
  return typeof params === 'object' ? params : {};
}

function isRuleVigente(rule, asOfDate) {
  const day = toDateOnlyString(asOfDate) || toDateOnlyString(new Date());
  const from = rule.vigenteDesde ? toDateOnlyString(rule.vigenteDesde) : null;
  const to = rule.vigenteHasta ? toDateOnlyString(rule.vigenteHasta) : null;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function evaluateCondition(condition, ctx) {
  const params = parseParams(condition.params);
  switch (condition.type) {
    case 'DATE_RANGE': {
      const day = toDateOnlyString(ctx.asOfDate) || toDateOnlyString(new Date());
      const from = params.from || params.desde || null;
      const to = params.to || params.hasta || null;
      if (from && day < String(from).slice(0, 10)) return false;
      if (to && day > String(to).slice(0, 10)) return false;
      return true;
    }
    case 'MIN_NIGHTS': {
      const nights = ctx.nights != null ? Number(ctx.nights) : civilDaysBetween(ctx.checkIn, ctx.checkOut);
      if (nights == null) return false;
      return nights >= Number(params.minNights ?? params.value ?? 0);
    }
    case 'MAX_NIGHTS': {
      const nights = ctx.nights != null ? Number(ctx.nights) : civilDaysBetween(ctx.checkIn, ctx.checkOut);
      if (nights == null) return false;
      return nights <= Number(params.maxNights ?? params.value ?? 0);
    }
    case 'ROOM_TYPE': {
      const ids = params.roomTypeIds || params.ids || (params.roomTypeId != null ? [params.roomTypeId] : []);
      if (!ids.length) return true;
      if (ctx.roomTypeId == null) return false;
      return ids.map(Number).includes(Number(ctx.roomTypeId));
    }
    case 'SERVICE_TYPE': {
      const ids = params.serviceTypeIds || params.ids || (params.serviceTypeId != null ? [params.serviceTypeId] : []);
      if (!ids.length) return true;
      if (ctx.serviceTypeId == null) return false;
      return ids.map(String).includes(String(ctx.serviceTypeId));
    }
    case 'PAYMENT_METHOD': {
      if (ctx.paymentMethodConfigId != null && params.paymentMethodConfigId != null) {
        return Number(ctx.paymentMethodConfigId) === Number(params.paymentMethodConfigId);
      }
      if (ctx.paymentMethodCode && params.paymentMethodCode) {
        return String(ctx.paymentMethodCode).toUpperCase() === String(params.paymentMethodCode).toUpperCase();
      }
      if (ctx.paymentMethodConfigId != null && Array.isArray(params.paymentMethodConfigIds)) {
        return params.paymentMethodConfigIds.map(Number).includes(Number(ctx.paymentMethodConfigId));
      }
      return false;
    }
    case 'OCCUPANCY_HOTEL_MAX': {
      if (ctx.occupancyPercent == null) return false;
      return Number(ctx.occupancyPercent) <= Number(params.maxPercent ?? params.value ?? 100);
    }
    case 'OCCUPANCY_HOTEL_MIN': {
      if (ctx.occupancyPercent == null) return false;
      return Number(ctx.occupancyPercent) >= Number(params.minPercent ?? params.value ?? 0);
    }
    default:
      return false;
  }
}

function ruleMatchesConditions(rule, ctx) {
  const conditions = rule.conditions || [];
  if (!conditions.length) return true;
  return conditions.every((c) => evaluateCondition(c, ctx));
}

function modalityAllowsApply(rule, ctx) {
  const modality = rule.modality || 'AUTO';
  if (modality === 'AUTO') return true;
  const selected = new Set((ctx.selectedRuleIds || []).map(Number));
  return selected.has(Number(rule.id));
}

function modalityIsSuggestion(rule) {
  return rule.modality === 'SUGERIDA' || rule.modality === 'MANUAL';
}

/**
 * Config legacy-compatible para paymentDiscount (PERCENT / FIXED settlement).
 */
function ruleToSettlementConfig(rule) {
  if (!rule) {
    return {
      descuentoActivo: false,
      descuentoTipo: 'PERCENT',
      descuentoValor: 0,
      aplicaEnParcial: true,
      aplicaEnSeña: true
    };
  }
  const benefitType = rule.benefitType || 'PERCENT';
  return {
    descuentoActivo: true,
    descuentoTipo: benefitType === 'FIXED' || benefitType === 'FIXED_PER_NIGHT' ? 'FIXED' : 'PERCENT',
    descuentoValor: toNumber(rule.benefitValue),
    aplicaEnParcial: rule.aplicaEnParcial !== false,
    aplicaEnSeña: rule.aplicaEnSeña !== false,
    benefitType,
    benefitBase: rule.benefitBase || 'DEBT_CANCELLED',
    benefitCapARS: rule.benefitCapARS != null ? toNumber(rule.benefitCapARS) : null,
    promotionRuleId: rule.id,
    promotionCode: rule.code,
    promotionLabel: rule.label,
    stacking: rule.stacking || 'EXCLUSIVE',
    stackingGroup: rule.stackingGroup || null,
    prioridad: rule.prioridad ?? 100,
    modality: rule.modality,
    layer: rule.layer
  };
}

function applyCap(amount, cap) {
  const a = roundMoney(amount);
  if (cap == null || !Number.isFinite(Number(cap)) || Number(cap) <= 0) return a;
  return roundMoney(Math.min(a, Number(cap)));
}

/**
 * Beneficio settlement sobre dinero recibido / saldo.
 * FIXED_PER_NIGHT usa ctx.nights.
 */
function computeSettlementBenefit({ rule, dineroARS, saldoPendiente, motivo, mode }) {
  const config = ruleToSettlementConfig(rule);
  const nights = Math.max(1, Number(rule._ctxNights) || 1);

  if (config.descuentoTipo === 'PERCENT') {
    if (mode === 'settle') {
      return computeCashToSettle({ saldoPendiente, config, motivo });
    }
    return computeDiscountFromReceived({
      dineroARS,
      config,
      motivo,
      saldoPendiente
    });
  }

  // FIXED / FIXED_PER_NIGHT: crédito = dinero + fijo (parcial) o dinero a pedir = saldo - fijo (total)
  let fixed = toNumber(config.descuentoValor);
  if (rule.benefitType === 'FIXED_PER_NIGHT') {
    fixed = roundMoney(fixed * nights);
  }
  fixed = applyCap(fixed, config.benefitCapARS);

  if (motivo === 'Seña' && config.aplicaEnSeña === false) {
    return {
      aplica: false,
      dineroARS: roundMoney(dineroARS || 0),
      descuentoARS: 0,
      creditoARS: roundMoney(dineroARS || saldoPendiente || 0),
      porcentaje: null,
      motivoNoAplica: 'no_aplica_sena'
    };
  }

  if (mode === 'settle') {
    const saldo = roundMoney(toNumber(saldoPendiente));
    const descuento = Math.min(fixed, Math.max(0, saldo));
    const dinero = roundMoney(Math.max(0, saldo - descuento));
    return {
      aplica: descuento > 0,
      saldoARS: saldo,
      dineroARS: dinero,
      descuentoARS: descuento,
      creditoARS: saldo,
      porcentaje: null,
      valorFijo: descuento
    };
  }

  const dinero = roundMoney(Math.abs(toNumber(dineroARS)));
  if (config.aplicaEnParcial === false && saldoPendiente != null) {
    const creditoTentativo = roundMoney(dinero + fixed);
    if (creditoTentativo + 0.005 < toNumber(saldoPendiente)) {
      return {
        aplica: false,
        dineroARS: dinero,
        descuentoARS: 0,
        creditoARS: dinero,
        porcentaje: null,
        motivoNoAplica: 'solo_pago_total'
      };
    }
  }
  const descuento = fixed;
  const credito = roundMoney(dinero + descuento);
  return {
    aplica: descuento > 0,
    dineroARS: dinero,
    descuentoARS: descuento,
    creditoARS: credito,
    porcentaje: null,
    valorFijo: descuento
  };
}

function sortByPriority(rules) {
  return [...rules].sort((a, b) => {
    const pa = a.prioridad ?? 100;
    const pb = b.prioridad ?? 100;
    if (pb !== pa) return pb - pa;
    return Number(a.id) - Number(b.id);
  });
}

/**
 * Selección según stacking (EXCLUSIVE / BEST_OF / STACKABLE).
 * Agrupa por stackingGroup (null = grupo global).
 */
function selectByStacking(matchedRules, benefitFn) {
  if (!matchedRules.length) return [];
  const groups = new Map();
  for (const rule of matchedRules) {
    const key = rule.stackingGroup || '__global__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  }

  const selected = [];
  for (const [, groupRules] of groups) {
    const ordered = sortByPriority(groupRules);
    const policy = ordered[0].stacking || 'EXCLUSIVE';
    if (policy === 'STACKABLE') {
      selected.push(...ordered);
      continue;
    }
    if (policy === 'BEST_OF') {
      let best = null;
      let bestAmount = -1;
      for (const rule of ordered) {
        const preview = benefitFn(rule);
        const amount = preview?.descuentoARS != null ? toNumber(preview.descuentoARS) : 0;
        if (amount > bestAmount) {
          bestAmount = amount;
          best = rule;
        }
      }
      if (best) selected.push(best);
      continue;
    }
    // EXCLUSIVE
    selected.push(ordered[0]);
  }
  return sortByPriority(selected);
}

function filterEligibleRules(rules, ctx, { forApply = true } = {}) {
  const layer = ctx.layer || 'SETTLEMENT';
  return (rules || []).filter((rule) => {
    if (!rule || rule.activo === false) return false;
    if ((rule.layer || 'SETTLEMENT') !== layer) return false;
    if (!isRuleVigente(rule, ctx.asOfDate)) return false;
    if (!ruleMatchesConditions(rule, ctx)) return false;
    if (forApply && !modalityAllowsApply(rule, ctx)) return false;
    return true;
  });
}

/**
 * Evalúa reglas settlement y devuelve preview + config agregada.
 */
function evaluateSettlementRules(rules, ctx) {
  const matched = filterEligibleRules(rules, { ...ctx, layer: 'SETTLEMENT' }, { forApply: true });
  const suggestions = filterEligibleRules(rules, { ...ctx, layer: 'SETTLEMENT' }, { forApply: false }).filter(
    (r) => modalityIsSuggestion(r) && !modalityAllowsApply(r, ctx)
  );

  const mode = ctx.mode === 'settle' ? 'settle' : 'received';
  const benefitFn = (rule) =>
    computeSettlementBenefit({
      rule: { ...rule, _ctxNights: ctx.nights },
      dineroARS: ctx.dineroARS,
      saldoPendiente: ctx.saldoPendiente,
      motivo: ctx.motivo || 'Pago',
      mode
    });

  const selected = selectByStacking(matched, benefitFn);
  if (!selected.length) {
    return {
      aplica: false,
      selectedRules: [],
      suggestions,
      dineroARS: roundMoney(toNumber(ctx.dineroARS || ctx.saldoPendiente || 0)),
      descuentoARS: 0,
      creditoARS: roundMoney(toNumber(ctx.dineroARS || ctx.saldoPendiente || 0)),
      porcentaje: null,
      config: ruleToSettlementConfig(null),
      appliedRules: []
    };
  }

  // Una sola regla PERCENT (paridad Efectivo): usar compute estándar.
  // STACKABLE: suma descuentos FIXED; si hay varios PERCENT, aplica el de mayor prioridad (no suma %).
  const percentRules = selected.filter((r) => r.benefitType === 'PERCENT');
  const fixedRules = selected.filter((r) => r.benefitType !== 'PERCENT');

  let combined = {
    aplica: false,
    dineroARS: 0,
    descuentoARS: 0,
    creditoARS: 0,
    porcentaje: null,
    valorFijo: null
  };
  const appliedRules = [];

  if (percentRules.length) {
    const primary = sortByPriority(percentRules)[0];
    const preview = benefitFn(primary);
    combined = { ...preview };
    appliedRules.push({
      promotionRuleId: primary.id,
      code: primary.code,
      label: primary.label,
      benefitType: primary.benefitType,
      benefitValue: toNumber(primary.benefitValue),
      montoARS: preview.descuentoARS,
      porcentaje: preview.porcentaje
    });
  }

  for (const rule of fixedRules) {
    const preview = benefitFn(rule);
    if (!preview.aplica) continue;
    combined.aplica = true;
    combined.descuentoARS = roundMoney(toNumber(combined.descuentoARS) + toNumber(preview.descuentoARS));
    if (mode === 'settle') {
      combined.dineroARS = roundMoney(Math.max(0, toNumber(ctx.saldoPendiente) - toNumber(combined.descuentoARS)));
      combined.creditoARS = roundMoney(toNumber(ctx.saldoPendiente));
    } else {
      combined.dineroARS = roundMoney(toNumber(ctx.dineroARS));
      combined.creditoARS = roundMoney(toNumber(combined.dineroARS) + toNumber(combined.descuentoARS));
    }
    appliedRules.push({
      promotionRuleId: rule.id,
      code: rule.code,
      label: rule.label,
      benefitType: rule.benefitType,
      benefitValue: toNumber(rule.benefitValue),
      montoARS: preview.descuentoARS,
      porcentaje: null
    });
  }

  const primary = selected[0];
  return {
    ...combined,
    selectedRules: selected,
    suggestions,
    config: ruleToSettlementConfig(primary),
    appliedRules,
    promotionRuleId: primary.id
  };
}

/**
 * Ajuste RATE sobre precio de una noche.
 */
function applyRateBenefit(rule, nightPrice, nights = 1) {
  const base = toNumber(nightPrice);
  const value = toNumber(rule.benefitValue);
  let discount = 0;
  let percent = null;
  if (rule.benefitType === 'PERCENT') {
    percent = value;
    discount = roundMoney(base * rateFromPercent(value));
  } else if (rule.benefitType === 'FIXED_PER_NIGHT') {
    discount = roundMoney(value);
  } else if (rule.benefitType === 'FIXED') {
    discount = roundMoney(value / Math.max(1, nights));
  }
  discount = applyCap(discount, rule.benefitCapARS);
  discount = Math.min(discount, base);
  return {
    originalARS: base,
    discountARS: discount,
    finalARS: roundMoney(Math.max(0, base - discount)),
    percent,
    promotionRuleId: rule.id
  };
}

function evaluateRateRules(rules, ctx) {
  const matched = filterEligibleRules(rules, { ...ctx, layer: 'RATE' }, { forApply: true });
  const suggestions = filterEligibleRules(rules, { ...ctx, layer: 'RATE' }, { forApply: false }).filter(
    (r) => modalityIsSuggestion(r) && !modalityAllowsApply(r, ctx)
  );
  const nightPrice = toNumber(ctx.nightPrice);
  const nights = Math.max(1, Number(ctx.nights) || 1);
  const benefitFn = (rule) => applyRateBenefit(rule, nightPrice, nights);
  const selected = selectByStacking(matched, (rule) => {
    const r = benefitFn(rule);
    return { descuentoARS: r.discountARS };
  });

  if (!selected.length) {
    return {
      aplica: false,
      finalARS: nightPrice,
      discountARS: 0,
      selectedRules: [],
      suggestions,
      appliedRules: []
    };
  }

  let price = nightPrice;
  let totalDiscount = 0;
  const appliedRules = [];
  for (const rule of selected) {
    const r = applyRateBenefit(rule, price, nights);
    totalDiscount = roundMoney(totalDiscount + r.discountARS);
    price = r.finalARS;
    appliedRules.push({
      promotionRuleId: rule.id,
      code: rule.code,
      label: rule.label,
      montoARS: r.discountARS,
      porcentaje: r.percent
    });
  }

  return {
    aplica: totalDiscount > 0,
    originalARS: nightPrice,
    discountARS: totalDiscount,
    finalARS: price,
    selectedRules: selected,
    suggestions,
    appliedRules,
    promotionRuleId: selected[0].id,
    promotionPercent: appliedRules.find((a) => a.porcentaje != null)?.porcentaje ?? null
  };
}

async function loadActivePromotionRules(db, { layer } = {}) {
  return db.promotionRule.findMany({
    where: {
      activo: true,
      ...(layer ? { layer } : {})
    },
    include: { conditions: true },
    orderBy: [{ prioridad: 'desc' }, { id: 'asc' }]
  });
}

/**
 * Ocupación hotel % (métrica operativa del día; no DynamicPricing).
 */
async function computeHotelOccupancyPercent(db, { hotelId, date } = {}) {
  const day = toDateOnlyString(date) || toDateOnlyString(new Date());
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const dayEnd = new Date(`${day}T23:59:59.999Z`);

  const roomWhere = hotelId
    ? { hotelId: String(hotelId), active: true }
    : { active: true };

  // Room.active puede no existir; fallback a count simple
  let totalRooms = 0;
  try {
    totalRooms = await db.room.count({
      where: hotelId ? { hotelId: String(hotelId) } : undefined
    });
  } catch {
    totalRooms = await db.room.count();
  }
  if (totalRooms <= 0) return 0;

  const segments = await db.reservationSegment.findMany({
    where: {
      startDate: { lte: dayEnd },
      endDate: { gt: dayStart },
      reservation: {
        status: { notIn: ['CANCELLED', 'NO_SHOW', 'CANCELADA'] }
      }
    },
    select: { roomId: true }
  });
  const occupied = new Set(segments.map((s) => s.roomId).filter(Boolean));
  return roundMoney((occupied.size / totalRooms) * 100);
}

module.exports = {
  toDateOnlyString,
  civilDaysBetween,
  parseParams,
  isRuleVigente,
  evaluateCondition,
  ruleMatchesConditions,
  modalityAllowsApply,
  ruleToSettlementConfig,
  computeSettlementBenefit,
  selectByStacking,
  filterEligibleRules,
  evaluateSettlementRules,
  applyRateBenefit,
  evaluateRateRules,
  loadActivePromotionRules,
  computeHotelOccupancyPercent
};
