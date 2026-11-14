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

function normalizeOp(op, fallback = 'eq') {
  const v = String(op || fallback).toLowerCase().trim();
  if (v === 'eq' || v === '=' || v === 'equals' || v === 'igual a' || v === 'igual') return 'eq';
  if (v === 'neq' || v === '!=' || v === 'ne' || v === 'not' || v === '≠' || v === 'distinto de' || v === 'distinto') {
    return 'neq';
  }
  if (v === 'gte' || v === '>=' || v === 'min' || v === '≥' || v === 'mayor o igual a' || v === 'mayor o igual') {
    return 'gte';
  }
  if (v === 'lte' || v === '<=' || v === 'max' || v === '≤' || v === 'menor o igual a' || v === 'menor o igual') {
    return 'lte';
  }
  if (v === 'gt' || v === '>' || v === 'mayor a' || v === 'mayor') return 'gt';
  if (v === 'lt' || v === '<' || v === 'menor a' || v === 'menor') return 'lt';
  return fallback;
}

function compareNumber(actual, op, expected) {
  const a = Number(actual);
  const e = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(e)) return false;
  switch (normalizeOp(op, 'eq')) {
    case 'eq':
      return a === e;
    case 'neq':
      return a !== e;
    case 'gt':
      return a > e;
    case 'gte':
      return a >= e;
    case 'lt':
      return a < e;
    case 'lte':
      return a <= e;
    default:
      return false;
  }
}

function resolveNights(ctx) {
  if (ctx.nights != null) return Number(ctx.nights);
  return civilDaysBetween(ctx.checkIn, ctx.checkOut);
}

/** Fecha de creación de la reserva (no confundir con estadía). */
function resolveBookingCreatedDay(ctx) {
  return (
    toDateOnlyString(ctx.reservationDate) ||
    toDateOnlyString(ctx.createdAt) ||
    toDateOnlyString(ctx.bookingCreatedAt)
  );
}

function weekdayFromDateOnly(day) {
  if (!day) return null;
  const t = Date.parse(`${day}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  return new Date(t).getUTCDay(); // 0=Dom … 6=Sáb
}

/** Noches de estadía [checkIn, checkOut) como yyyy-MM-dd. */
function stayNightDates(ctx) {
  const start = toDateOnlyString(ctx.checkIn);
  const end = toDateOnlyString(ctx.checkOut);
  if (!start) return [];
  if (!end || end <= start) return [start];
  const nights = [];
  let cursor = start;
  while (cursor < end) {
    nights.push(cursor);
    const t = Date.parse(`${cursor}T12:00:00.000Z`) + 86400000;
    cursor = new Date(t).toISOString().slice(0, 10);
    if (nights.length > 366) break;
  }
  return nights;
}

function normalizeDateOp(op, fallback = 'between') {
  const v = String(op || fallback).toLowerCase();
  if (v === 'between' || v === 'entre') return 'between';
  if (v === 'includes' || v === 'incluye' || v === 'include') return 'includes';
  if (
    v === 'excludes' ||
    v === 'exclude' ||
    v === 'not_includes' ||
    v === 'not-includes' ||
    v === 'no_incluye' ||
    v === 'no-incluye' ||
    v === 'no incluye'
  ) {
    return 'excludes';
  }
  return fallback;
}

function dayInRange(day, from, to) {
  if (!day) return false;
  const d = String(day).slice(0, 10);
  if (from && d < String(from).slice(0, 10)) return false;
  if (to && d > String(to).slice(0, 10)) return false;
  return true;
}

/** Solape de estadía [checkIn, checkOut) con [from, to] inclusive. */
function stayOverlapsRange(ctx, from, to) {
  const nights = stayNightDates(ctx);
  if (!nights.length) return false;
  if (!from && !to) return true;
  return nights.some((n) => dayInRange(n, from, to));
}

function stayWeekdays(ctx) {
  return new Set(stayNightDates(ctx).map(weekdayFromDateOnly).filter((d) => d != null));
}

function matchStayWeekdays(ctx, days, op) {
  const wanted = (days || []).map(Number);
  if (!wanted.length) return true;
  const present = stayWeekdays(ctx);
  if (!present.size) return false;
  const hits = wanted.some((d) => present.has(d));
  return normalizeDateOp(op, 'includes') === 'excludes' ? !hits : hits;
}

function matchIdList(actual, ids, asNumber) {
  if (actual == null) return false;
  const list = (ids || []).map((id) => (asNumber ? Number(id) : String(id)));
  const value = asNumber ? Number(actual) : String(actual);
  return list.includes(value);
}

function applyEqualityOp(matched, op) {
  return normalizeOp(op, 'eq') === 'neq' ? !matched : matched;
}

function evaluateStayDateCondition(params, ctx) {
  const op = normalizeDateOp(params.op, 'between');
  if (op === 'between') {
    const from = params.from || params.desde || null;
    const to = params.to || params.hasta || null;
    return stayOverlapsRange(ctx, from, to);
  }
  // incluye / no incluye: días de la semana presentes en alguna noche de estadía
  const days = params.days || params.weekdays || [];
  return matchStayWeekdays(ctx, days, op);
}

function evaluateCondition(condition, ctx) {
  const params = parseParams(condition.params);
  switch (condition.type) {
    case 'DATE_RANGE': {
      // Fecha creación reserva (booking), no estadía
      const day = resolveBookingCreatedDay(ctx);
      const from = params.from || params.desde || null;
      const to = params.to || params.hasta || null;
      if (!day) return false;
      return dayInRange(day, from, to);
    }
    case 'STAY_DATE': {
      return evaluateStayDateCondition(params, ctx);
    }
    case 'NIGHTS': {
      const nights = resolveNights(ctx);
      if (nights == null) return false;
      return compareNumber(nights, params.op || 'gte', params.value ?? params.nights ?? 0);
    }
    case 'MIN_NIGHTS': {
      const nights = resolveNights(ctx);
      if (nights == null) return false;
      return nights >= Number(params.minNights ?? params.value ?? 0);
    }
    case 'MAX_NIGHTS': {
      const nights = resolveNights(ctx);
      if (nights == null) return false;
      return nights <= Number(params.maxNights ?? params.value ?? 0);
    }
    case 'ROOM_TYPE': {
      const ids = params.roomTypeIds || params.ids || (params.roomTypeId != null ? [params.roomTypeId] : []);
      if (!ids.length) return true;
      const matched = matchIdList(ctx.roomTypeId, ids, true);
      return applyEqualityOp(matched, params.op);
    }
    case 'SERVICE_TYPE': {
      const ids = params.serviceTypeIds || params.ids || (params.serviceTypeId != null ? [params.serviceTypeId] : []);
      if (!ids.length) return true;
      const matched = matchIdList(ctx.serviceTypeId, ids, false);
      return applyEqualityOp(matched, params.op);
    }
    case 'PAYMENT_METHOD': {
      let matched = null;
      if (ctx.paymentMethodConfigId != null && params.paymentMethodConfigId != null) {
        matched = Number(ctx.paymentMethodConfigId) === Number(params.paymentMethodConfigId);
      } else if (ctx.paymentMethodCode && params.paymentMethodCode) {
        matched =
          String(ctx.paymentMethodCode).toUpperCase() === String(params.paymentMethodCode).toUpperCase();
      } else if (ctx.paymentMethodConfigId != null && Array.isArray(params.paymentMethodConfigIds)) {
        matched = params.paymentMethodConfigIds.map(Number).includes(Number(ctx.paymentMethodConfigId));
      }
      if (matched == null) return false;
      return applyEqualityOp(matched, params.op);
    }
    case 'OCCUPANCY_HOTEL': {
      if (ctx.occupancyPercent == null) return false;
      return compareNumber(
        ctx.occupancyPercent,
        params.op || 'lte',
        params.percent ?? params.value ?? params.maxPercent ?? params.minPercent ?? 0
      );
    }
    case 'OCCUPANCY_HOTEL_MAX': {
      if (ctx.occupancyPercent == null) return false;
      return Number(ctx.occupancyPercent) <= Number(params.maxPercent ?? params.value ?? 100);
    }
    case 'OCCUPANCY_HOTEL_MIN': {
      if (ctx.occupancyPercent == null) return false;
      return Number(ctx.occupancyPercent) >= Number(params.minPercent ?? params.value ?? 0);
    }
    case 'DAYS_OF_WEEK': {
      // Compat: días de la semana sobre noches de estadía (incluye / no incluye)
      return evaluateStayDateCondition(
        { ...params, op: params.op || 'includes' },
        ctx
      );
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
  if (benefitType === 'FREE_NIGHTS') {
    return {
      descuentoActivo: false,
      descuentoTipo: 'PERCENT',
      descuentoValor: 0,
      aplicaEnParcial: true,
      aplicaEnSeña: true,
      benefitType,
      benefitBase: rule.benefitBase || 'RATE_NIGHT',
      benefitCapARS: null,
      promotionRuleId: rule.id,
      promotionCode: rule.code,
      promotionLabel: rule.label,
      stacking: rule.stacking || 'EXCLUSIVE',
      stackingGroup: rule.stackingGroup || null,
      prioridad: rule.prioridad ?? 100,
      modality: rule.modality,
      layer: rule.layer || 'RATE'
    };
  }
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
 * FREE_NIGHTS: benefitValue = noches que paga (paga N queda N+1).
 * Cantidad de noches gratis = floor(totalNights / (N + 1)).
 */
function computeFreeNightCount(rule, nights) {
  const paga = Math.max(0, Math.floor(toNumber(rule.benefitValue)));
  if (paga <= 0) return 0;
  const total = Math.max(0, Math.floor(Number(nights) || 0));
  return Math.floor(total / (paga + 1));
}

/**
 * Índices de las noches más baratas (empate → índice menor).
 */
function pickCheapestNightIndices(nightPrices, freeCount) {
  const count = Math.max(0, Math.floor(Number(freeCount) || 0));
  if (count <= 0 || !Array.isArray(nightPrices) || !nightPrices.length) return [];
  const ranked = nightPrices
    .map((price, index) => ({ index, price: toNumber(price) }))
    .sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      return a.index - b.index;
    });
  return ranked.slice(0, Math.min(count, ranked.length)).map((r) => r.index);
}

/**
 * Evalúa reglas FREE_NIGHTS a nivel estadía (no por noche aislada).
 * Devuelve byIndex: { [nightIndex]: { discountARS, finalARS, promotionRuleId, percent } }.
 */
function evaluateFreeNightsForStay(rules, ctx, nightPrices) {
  const prices = Array.isArray(nightPrices) ? nightPrices.map(toNumber) : [];
  const nights = Math.max(prices.length, Number(ctx.nights) || 0);
  const freeRules = (rules || []).filter((r) => r && r.benefitType === 'FREE_NIGHTS');
  const matched = filterEligibleRules(freeRules, { ...ctx, layer: 'RATE', nights }, { forApply: true });
  const suggestions = filterEligibleRules(freeRules, { ...ctx, layer: 'RATE', nights }, { forApply: false }).filter(
    (r) => modalityIsSuggestion(r) && !modalityAllowsApply(r, ctx)
  );

  const benefitFn = (rule) => {
    const freeCount = computeFreeNightCount(rule, nights);
    const indices = pickCheapestNightIndices(prices, freeCount);
    const descuentoARS = roundMoney(indices.reduce((sum, i) => sum + toNumber(prices[i]), 0));
    return { descuentoARS, freeCount, indices };
  };

  const selected = selectByStacking(matched, benefitFn);
  const byIndex = {};
  const appliedRules = [];
  let totalDiscount = 0;
  const claimed = new Set();

  for (const rule of selected) {
    const preview = benefitFn(rule);
    const available = preview.indices.filter((i) => !claimed.has(i));
    let ruleDiscount = 0;
    for (const index of available) {
      const original = toNumber(prices[index]);
      claimed.add(index);
      ruleDiscount = roundMoney(ruleDiscount + original);
      byIndex[index] = {
        originalARS: original,
        discountARS: original,
        finalARS: 0,
        percent: 100,
        promotionRuleId: rule.id,
        code: rule.code,
        label: rule.label,
        freeNight: true
      };
    }
    if (ruleDiscount > 0) {
      totalDiscount = roundMoney(totalDiscount + ruleDiscount);
      appliedRules.push({
        promotionRuleId: rule.id,
        code: rule.code,
        label: rule.label,
        benefitType: 'FREE_NIGHTS',
        benefitValue: toNumber(rule.benefitValue),
        freeNightCount: available.length,
        nightIndices: available,
        montoARS: ruleDiscount,
        porcentaje: 100
      });
    }
  }

  return {
    aplica: totalDiscount > 0,
    discountARS: totalDiscount,
    freeNightCount: Object.keys(byIndex).length,
    byIndex,
    selectedRules: selected,
    suggestions,
    appliedRules,
    promotionRuleId: selected[0]?.id ?? null
  };
}

/**
 * Ajuste RATE sobre precio de una noche.
 * FREE_NIGHTS no aplica aquí (requiere estadía completa → evaluateFreeNightsForStay).
 */
function applyRateBenefit(rule, nightPrice, nights = 1) {
  const base = toNumber(nightPrice);
  if (rule.benefitType === 'FREE_NIGHTS') {
    return {
      originalARS: base,
      discountARS: 0,
      finalARS: base,
      percent: null,
      promotionRuleId: rule.id
    };
  }
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
  const nightPrices = Array.isArray(ctx.nightPrices) ? ctx.nightPrices.map(toNumber) : null;
  if (nightPrices && nightPrices.length) {
    const freeEval = evaluateFreeNightsForStay(rules, ctx, nightPrices);
    const nonFreeRules = (rules || []).filter((r) => r && r.benefitType !== 'FREE_NIGHTS');
    const perNight = nightPrices.map((price, index) => {
      if (freeEval.byIndex[index]) {
        return { ...freeEval.byIndex[index], nightIndex: index };
      }
      const nightEval = evaluateRateRules(nonFreeRules, {
        ...ctx,
        nightPrices: undefined,
        nightPrice: price,
        nights: nightPrices.length
      });
      return {
        nightIndex: index,
        originalARS: price,
        discountARS: nightEval.discountARS || 0,
        finalARS: nightEval.finalARS,
        percent: nightEval.promotionPercent,
        promotionRuleId: nightEval.promotionRuleId || null,
        freeNight: false,
        appliedRules: nightEval.appliedRules
      };
    });
    const discountARS = roundMoney(perNight.reduce((s, n) => s + toNumber(n.discountARS), 0));
    const finalARS = roundMoney(perNight.reduce((s, n) => s + toNumber(n.finalARS), 0));
    return {
      aplica: discountARS > 0,
      originalARS: roundMoney(nightPrices.reduce((s, p) => s + toNumber(p), 0)),
      discountARS,
      finalARS,
      nights: perNight,
      freeNights: freeEval,
      selectedRules: freeEval.selectedRules,
      suggestions: freeEval.suggestions,
      appliedRules: freeEval.appliedRules,
      promotionRuleId: freeEval.promotionRuleId
    };
  }

  const matched = filterEligibleRules(rules, { ...ctx, layer: 'RATE' }, { forApply: true }).filter(
    (r) => r.benefitType !== 'FREE_NIGHTS'
  );
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
  stayNightDates,
  evaluateCondition,
  ruleMatchesConditions,
  modalityAllowsApply,
  ruleToSettlementConfig,
  computeSettlementBenefit,
  selectByStacking,
  filterEligibleRules,
  evaluateSettlementRules,
  computeFreeNightCount,
  pickCheapestNightIndices,
  evaluateFreeNightsForStay,
  applyRateBenefit,
  evaluateRateRules,
  loadActivePromotionRules,
  computeHotelOccupancyPercent
};
