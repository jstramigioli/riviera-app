const {
  evaluateCondition,
  ruleMatchesConditions,
  evaluateSettlementRules,
  evaluateRateRules,
  applyRateBenefit,
  allocateFixedStayDiscounts,
  selectByStacking,
  isRuleVigente,
  computeFreeNightCount,
  pickCheapestNightIndices,
  evaluateFreeNightsForStay,
  effectiveBenefitValue,
  withEffectiveBenefit
} = require('../../src/utils/promotionEngine');

const efectivoRule = {
  id: 1,
  code: 'PAYDISC_EFECTIVO',
  label: 'Descuento Efectivo',
  activo: true,
  prioridad: 900,
  modality: 'AUTO',
  layer: 'SETTLEMENT',
  stacking: 'EXCLUSIVE',
  stackingGroup: null,
  aplicaEnParcial: true,
  aplicaEnSeña: true,
  benefitType: 'PERCENT',
  benefitValue: 10,
  benefitBase: 'DEBT_CANCELLED',
  conditions: [
    {
      type: 'PAYMENT_METHOD',
      params: { paymentMethodConfigId: 1, paymentMethodCode: 'EFECTIVO' }
    }
  ]
};

describe('promotionEngine conditions AND', () => {
  it('PAYMENT_METHOD match', () => {
    expect(
      evaluateCondition(efectivoRule.conditions[0], { paymentMethodConfigId: 1 })
    ).toBe(true);
    expect(
      evaluateCondition(efectivoRule.conditions[0], { paymentMethodConfigId: 2 })
    ).toBe(false);
  });

  it('CURRENCY y AMOUNT_TO_SETTLE', () => {
    expect(
      evaluateCondition(
        { type: 'CURRENCY', params: { currency: 'USD', op: 'eq' } },
        { moneda: 'USD' }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'CURRENCY', params: { currency: 'USD', op: 'eq' } },
        { moneda: 'ARS' }
      )
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: 'AMOUNT_TO_SETTLE', params: { op: 'gte', value: 10000 } },
        { saldoPendiente: 15000 }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'AMOUNT_TO_SETTLE', params: { op: 'gte', value: 10000 } },
        { saldoPendiente: 5000 }
      )
    ).toBe(false);
  });

  it('MIN_NIGHTS + ROOM_TYPE AND', () => {
    const rule = {
      conditions: [
        { type: 'MIN_NIGHTS', params: { minNights: 7 } },
        { type: 'ROOM_TYPE', params: { roomTypeIds: [3, 4] } }
      ]
    };
    expect(ruleMatchesConditions(rule, { nights: 7, roomTypeId: 3 })).toBe(true);
    expect(ruleMatchesConditions(rule, { nights: 6, roomTypeId: 3 })).toBe(false);
    expect(ruleMatchesConditions(rule, { nights: 7, roomTypeId: 9 })).toBe(false);
  });

  it('NIGHTS ops + ROOM_TYPE neq', () => {
    expect(
      evaluateCondition({ type: 'NIGHTS', params: { op: 'eq', value: 3 } }, { nights: 3 })
    ).toBe(true);
    expect(
      evaluateCondition({ type: 'NIGHTS', params: { op: 'neq', value: 3 } }, { nights: 3 })
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: 'ROOM_TYPE', params: { roomTypeIds: [2], op: 'neq' } },
        { roomTypeId: 2 }
      )
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: 'ROOM_TYPE', params: { roomTypeIds: [2], op: 'neq' } },
        { roomTypeId: 5 }
      )
    ).toBe(true);
  });

  it('OCCUPANCY_HOTEL ops + DATE_RANGE creación + STAY_DATE', () => {
    expect(
      evaluateCondition(
        { type: 'OCCUPANCY_HOTEL', params: { op: 'lte', percent: 40 } },
        { occupancyPercent: 35 }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'OCCUPANCY_HOTEL', params: { op: 'lt', percent: 40 } },
        { occupancyPercent: 40 }
      )
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: 'OCCUPANCY_HOTEL', params: { op: 'lt', percent: 40 } },
        { occupancyPercent: 39 }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'OCCUPANCY_HOTEL', params: { op: 'gt', percent: 70 } },
        { occupancyPercent: 70 }
      )
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: 'OCCUPANCY_HOTEL', params: { op: 'gt', percent: 70 } },
        { occupancyPercent: 71 }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'OCCUPANCY_HOTEL', params: { op: 'mayor a', percent: 50 } },
        { occupancyPercent: 51 }
      )
    ).toBe(true);
    // Fecha creación reserva: no usa checkIn
    expect(
      evaluateCondition(
        { type: 'DATE_RANGE', params: { from: '2026-11-01', to: '2026-11-30' } },
        { reservationDate: '2026-11-14', checkIn: '2026-12-20' }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'DATE_RANGE', params: { from: '2026-11-01', to: '2026-11-30' } },
        { checkIn: '2026-11-14' }
      )
    ).toBe(false);
    // Estadía entre
    expect(
      evaluateCondition(
        { type: 'STAY_DATE', params: { op: 'between', from: '2026-12-01', to: '2026-12-31' } },
        { checkIn: '2026-12-20', checkOut: '2026-12-23' }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'STAY_DATE', params: { op: 'between', from: '2026-12-01', to: '2026-12-10' } },
        { checkIn: '2026-12-20', checkOut: '2026-12-23' }
      )
    ).toBe(false);
    // STAY_DATE incluye / no incluye: siempre rango (mismo día = inicio=fin)
    expect(
      evaluateCondition(
        { type: 'STAY_DATE', params: { op: 'includes', from: '2026-12-24', to: '2026-12-24' } },
        { checkIn: '2026-12-23', checkOut: '2026-12-26' }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'STAY_DATE', params: { op: 'includes', from: '2026-12-24', to: '2026-12-24' } },
        { checkIn: '2026-12-20', checkOut: '2026-12-23' }
      )
    ).toBe(false);
    expect(
      evaluateCondition(
        { type: 'STAY_DATE', params: { op: 'includes', from: '2026-12-22', to: '2026-12-24' } },
        { checkIn: '2026-12-23', checkOut: '2026-12-26' }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'STAY_DATE', params: { op: 'excludes', from: '2026-12-24', to: '2026-12-24' } },
        { checkIn: '2026-12-20', checkOut: '2026-12-23' }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'STAY_DATE', params: { op: 'excludes', from: '2026-12-24', to: '2026-12-24' } },
        { checkIn: '2026-12-23', checkOut: '2026-12-26' }
      )
    ).toBe(false);
    // Compat legacy: date puntual → rango mismo día
    expect(
      evaluateCondition(
        { type: 'STAY_DATE', params: { op: 'includes', date: '2026-12-24' } },
        { checkIn: '2026-12-23', checkOut: '2026-12-26' }
      )
    ).toBe(true);
    // Compat legacy STAY_DATE + days → weekday match
    expect(
      evaluateCondition(
        { type: 'STAY_DATE', params: { op: 'includes', days: [5, 6] } },
        { checkIn: '2026-11-13', checkOut: '2026-11-15' }
      )
    ).toBe(true);
    // DAYS_OF_WEEK incluye / no incluye (independiente de fechas)
    expect(
      evaluateCondition(
        { type: 'DAYS_OF_WEEK', params: { op: 'includes', days: [5, 6] } },
        { checkIn: '2026-11-13', checkOut: '2026-11-15' }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'DAYS_OF_WEEK', params: { op: 'excludes', days: [0] } },
        { checkIn: '2026-11-13', checkOut: '2026-11-15' }
      )
    ).toBe(true);
    expect(
      evaluateCondition(
        { type: 'DAYS_OF_WEEK', params: { op: 'excludes', days: [5] } },
        { checkIn: '2026-11-13', checkOut: '2026-11-15' }
      )
    ).toBe(false);
  });

  it('vigencia', () => {
    const rule = {
      vigenteDesde: '2026-11-01',
      vigenteHasta: '2026-11-30'
    };
    expect(isRuleVigente(rule, '2026-11-14')).toBe(true);
    expect(isRuleVigente(rule, '2026-12-01')).toBe(false);
  });
});

describe('promotionEngine settlement Efectivo 10% paridad', () => {
  it('parcial: crédito = recibido/(1-p)', () => {
    const r = evaluateSettlementRules([efectivoRule], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      dineroARS: 45000,
      saldoPendiente: 100000,
      motivo: 'Cobro',
      mode: 'received'
    });
    expect(r.aplica).toBe(true);
    expect(r.dineroARS).toBe(45000);
    expect(r.creditoARS).toBe(50000);
    expect(r.descuentoARS).toBe(5000);
    expect(r.promotionRuleId).toBe(1);
  });

  it('total: dinero = saldo*(1-p)', () => {
    const r = evaluateSettlementRules([efectivoRule], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      saldoPendiente: 100000,
      motivo: 'Cobro',
      mode: 'settle'
    });
    expect(r.aplica).toBe(true);
    expect(r.dineroARS).toBe(90000);
    expect(r.descuentoARS).toBe(10000);
  });

  it('sin match de medio: no aplica', () => {
    const r = evaluateSettlementRules([efectivoRule], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 99,
      dineroARS: 45000,
      mode: 'received'
    });
    expect(r.aplica).toBe(false);
    expect(r.descuentoARS).toBe(0);
  });

  it('MANUAL requiere selectedRuleIds', () => {
    const manual = { ...efectivoRule, id: 2, modality: 'MANUAL', code: 'MANUAL_10' };
    const without = evaluateSettlementRules([manual], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      dineroARS: 45000,
      mode: 'received',
      selectedRuleIds: []
    });
    expect(without.aplica).toBe(false);
    expect(without.suggestions.length).toBe(1);
    expect(without.suggestions[0].defaultOn).toBe(false);

    const withSel = evaluateSettlementRules([manual], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      dineroARS: 45000,
      mode: 'received',
      selectedRuleIds: [2]
    });
    expect(withSel.aplica).toBe(true);
    expect(withSel.descuentoARS).toBe(5000);
  });

  it('SUGERIDA = opcional por defecto activado (defaultOn)', () => {
    const sugerida = { ...efectivoRule, id: 3, modality: 'SUGERIDA', code: 'SUG_10' };
    const without = evaluateSettlementRules([sugerida], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      dineroARS: 45000,
      mode: 'received',
      selectedRuleIds: []
    });
    expect(without.aplica).toBe(false);
    expect(without.suggestions.length).toBe(1);
    expect(without.suggestions[0].defaultOn).toBe(true);

    const withSel = evaluateSettlementRules([sugerida], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      dineroARS: 45000,
      mode: 'received',
      selectedRuleIds: [3]
    });
    expect(withSel.aplica).toBe(true);
    expect(withSel.descuentoARS).toBe(5000);

    const withDefaults = evaluateSettlementRules([sugerida], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      dineroARS: 45000,
      mode: 'received',
      selectedRuleIds: [],
      applySuggestedDefaults: true
    });
    expect(withDefaults.aplica).toBe(true);
    expect(withDefaults.descuentoARS).toBe(5000);
    expect(withDefaults.appliedRules[0].modality).toBe('SUGERIDA');
    expect(withDefaults.appliedRules[0].defaultOn).toBe(true);
    expect(withDefaults.appliedRules[0].label).toBeTruthy();
    expect(withDefaults.appliedRules[0].montoARS).toBe(5000);

    const deselected = evaluateSettlementRules([sugerida], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      dineroARS: 45000,
      mode: 'received',
      selectedRuleIds: [],
      applySuggestedDefaults: true,
      deselectedRuleIds: [3]
    });
    expect(deselected.aplica).toBe(false);
    expect(deselected.descuentoARS).toBe(0);
  });

  it('SETTLEMENT: % global + % de medio se SUMAN (no EXCLUSIVE)', () => {
    const always = {
      ...efectivoRule,
      id: 2,
      code: 'ALWAYS_10',
      label: 'Siempre 10%',
      conditions: [],
      stacking: 'EXCLUSIVE',
      stackingGroup: null,
      prioridad: 100
    };
    const debito = {
      ...efectivoRule,
      id: 14,
      code: 'DEBITO_20',
      label: '20% debito',
      benefitValue: 20,
      conditions: [{ type: 'PAYMENT_METHOD', params: { paymentMethodConfigId: 2 } }],
      stacking: 'EXCLUSIVE',
      stackingGroup: null,
      prioridad: 100
    };

    const onDebito = evaluateSettlementRules([always, debito], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 2,
      saldoPendiente: 10000,
      mode: 'settle'
    });
    expect(onDebito.aplica).toBe(true);
    expect(onDebito.appliedRules).toHaveLength(2);
    expect(onDebito.porcentaje).toBe(30);
    expect(onDebito.descuentoARS).toBe(3000);
    expect(onDebito.dineroARS).toBe(7000);
    expect(
      onDebito.appliedRules.map((r) => r.promotionRuleId).sort((a, b) => a - b)
    ).toEqual([2, 14]);

    const onTransfer = evaluateSettlementRules([always, debito], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 4,
      saldoPendiente: 10000,
      mode: 'settle'
    });
    expect(onTransfer.aplica).toBe(true);
    expect(onTransfer.appliedRules).toHaveLength(1);
    expect(onTransfer.appliedRules[0].promotionRuleId).toBe(2);
    expect(onTransfer.porcentaje).toBe(10);
    expect(onTransfer.descuentoARS).toBe(1000);
  });

  it('SETTLEMENT: applyAutomatics=false omite AUTO y deja opcionales', () => {
    const auto = {
      ...efectivoRule,
      id: 2,
      code: 'ALWAYS_10',
      label: 'Siempre 10%',
      modality: 'AUTO',
      conditions: [],
      stacking: 'EXCLUSIVE'
    };
    const optional = {
      ...efectivoRule,
      id: 9,
      code: 'MANUAL_5',
      label: 'Manual 5%',
      modality: 'MANUAL',
      benefitValue: 5,
      conditions: [],
      stacking: 'EXCLUSIVE'
    };

    const off = evaluateSettlementRules([auto, optional], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      dineroARS: 10000,
      mode: 'received',
      applyAutomatics: false,
      selectedRuleIds: [9]
    });
    expect(off.aplica).toBe(true);
    expect(off.appliedRules).toHaveLength(1);
    expect(off.appliedRules[0].promotionRuleId).toBe(9);
    expect(off.porcentaje).toBe(5);

    const on = evaluateSettlementRules([auto, optional], {
      layer: 'SETTLEMENT',
      paymentMethodConfigId: 1,
      dineroARS: 10000,
      mode: 'received',
      applyAutomatics: true,
      selectedRuleIds: [9]
    });
    expect(on.aplica).toBe(true);
    expect(on.appliedRules).toHaveLength(2);
    expect(on.porcentaje).toBe(15);
  });
});

describe('promotionEngine rate + stacking', () => {
  it('PERCENT sobre noche', () => {
    const rule = {
      id: 10,
      code: 'RATE10',
      label: '10% tarifa',
      activo: true,
      prioridad: 50,
      modality: 'AUTO',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'PERCENT',
      benefitValue: 10,
      benefitCapARS: null,
      conditions: []
    };
    const r = applyRateBenefit(rule, 100000, 3);
    expect(r.discountARS).toBe(10000);
    expect(r.finalARS).toBe(90000);
  });

  it('FIXED_PER_NIGHT', () => {
    const rule = {
      id: 11,
      benefitType: 'FIXED_PER_NIGHT',
      benefitValue: 5000,
      benefitCapARS: null
    };
    const r = applyRateBenefit(rule, 40000, 5);
    expect(r.discountARS).toBe(5000);
    expect(r.finalARS).toBe(35000);
  });

  it('EXCLUSIVE elige mayor prioridad', () => {
    const a = {
      id: 1,
      prioridad: 10,
      stacking: 'EXCLUSIVE',
      stackingGroup: null,
      benefitType: 'PERCENT',
      benefitValue: 5
    };
    const b = {
      id: 2,
      prioridad: 90,
      stacking: 'EXCLUSIVE',
      stackingGroup: null,
      benefitType: 'PERCENT',
      benefitValue: 15
    };
    const selected = selectByStacking([a, b], (rule) => ({
      descuentoARS: Number(rule.benefitValue)
    }));
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(2);
  });

  it('evaluateRateRules AUTO', () => {
    const rule = {
      id: 20,
      code: 'OCC40',
      label: 'Baja ocupación',
      activo: true,
      prioridad: 100,
      modality: 'AUTO',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'PERCENT',
      benefitValue: 20,
      conditions: [{ type: 'OCCUPANCY_HOTEL_MAX', params: { maxPercent: 40 } }]
    };
    const hit = evaluateRateRules([rule], {
      layer: 'RATE',
      nightPrice: 50000,
      occupancyPercent: 35,
      nights: 2
    });
    expect(hit.aplica).toBe(true);
    expect(hit.finalARS).toBe(40000);

    const miss = evaluateRateRules([rule], {
      layer: 'RATE',
      nightPrice: 50000,
      occupancyPercent: 80,
      nights: 2
    });
    expect(miss.aplica).toBe(false);
  });

  it('evaluateRateRules AUTO PERCENT sin condiciones (Consulta)', () => {
    const rule = {
      id: 10,
      code: 'PROMO_PRUEBA_AUTOMATICA',
      label: 'Promo prueba automática',
      kind: 'PROMO',
      activo: true,
      prioridad: 100,
      modality: 'AUTO',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'PERCENT',
      benefitValue: 10,
      benefitBase: 'RATE_NIGHT',
      conditions: []
    };
    expect(ruleMatchesConditions(rule, { nights: 3 })).toBe(true);

    const stay = evaluateRateRules([rule], {
      layer: 'RATE',
      nights: 3,
      nightPrices: [100000, 100000, 100000],
      applySuggestedDefaults: true
    });
    expect(stay.aplica).toBe(true);
    expect(stay.discountARS).toBe(30000);
    expect(stay.appliedRules).toHaveLength(1);
    expect(stay.appliedRules[0].code).toBe('PROMO_PRUEBA_AUTOMATICA');

    // Misma regla mal guardada en SETTLEMENT: Consulta (layer RATE) no la ve.
    const wrongLayer = evaluateRateRules([{ ...rule, layer: 'SETTLEMENT' }], {
      layer: 'RATE',
      nights: 3,
      nightPrices: [100000, 100000, 100000],
      applySuggestedDefaults: true
    });
    expect(wrongLayer.aplica).toBe(false);
    expect(wrongLayer.discountARS || 0).toBe(0);
  });

  it('AUTO FIXED total no lo come otro AUTO % EXCLUSIVE sin stackingGroup', () => {
    const autoPct = {
      id: 10,
      code: 'AUTO10',
      label: 'Auto 10%',
      activo: true,
      prioridad: 100,
      modality: 'AUTO',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      stackingGroup: null,
      benefitType: 'PERCENT',
      benefitValue: 10,
      conditions: []
    };
    const autoFixed = {
      id: 12,
      code: 'FIXED10K',
      label: 'Fijo 10000',
      activo: true,
      prioridad: 100,
      modality: 'AUTO',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      stackingGroup: null,
      benefitType: 'FIXED',
      benefitValue: 10000,
      conditions: []
    };
    const prices = [100000, 100000, 100000, 100000, 100000, 100000];
    const stay = evaluateRateRules([autoPct, autoFixed], {
      layer: 'RATE',
      nights: 6,
      nightPrices: prices,
      applySuggestedDefaults: true
    });
    const codes = stay.appliedRules.map((r) => r.code).sort();
    expect(codes).toEqual(['AUTO10', 'FIXED10K']);
    expect(stay.appliedRules.find((r) => r.code === 'FIXED10K').montoARS).toBe(10000);
    expect(stay.appliedRules.find((r) => r.code === 'AUTO10').montoARS).toBe(60000);
    expect(stay.discountARS).toBe(70000);
    const nightDiscSum = (stay.nights || []).reduce(
      (s, n) => s + (Number(n.discountARS) || 0),
      0
    );
    expect(Number(nightDiscSum.toFixed(2))).toBe(70000);
  });

  it('FIXED 10000 en N noches: monto exacto (no 10000.12)', () => {
    const prices = [183333.33, 183333.33, 183333.34, 200000, 200000, 200000];
    const alloc = allocateFixedStayDiscounts(10000, prices);
    const cents = alloc.reduce((s, d) => s + Math.round(d * 100), 0);
    expect(cents).toBe(1000000);
    expect(Number(alloc.reduce((s, d) => s + d, 0).toFixed(2))).toBe(10000);

    const rule = {
      id: 12,
      code: 'FIXED10K',
      label: 'Fijo',
      activo: true,
      prioridad: 100,
      modality: 'AUTO',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'FIXED',
      benefitValue: 10000,
      conditions: []
    };
    const stay = evaluateRateRules([rule], {
      layer: 'RATE',
      nights: prices.length,
      nightPrices: prices,
      applySuggestedDefaults: true
    });
    expect(stay.appliedRules[0].montoARS).toBe(10000);
    expect(stay.discountARS).toBe(10000);
    expect(stay.discountARS).not.toBe(10000.12);
  });

  it('SUGERIDA % sin condiciones no la come EXCLUSIVE de un AUTO', () => {
    const auto = {
      id: 10,
      code: 'AUTO10',
      label: 'Auto',
      activo: true,
      prioridad: 100,
      modality: 'AUTO',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'PERCENT',
      benefitValue: 10,
      conditions: []
    };
    const sugerida = {
      id: 11,
      code: 'OPT_ON',
      label: 'Opcional ON',
      activo: true,
      prioridad: 100,
      modality: 'SUGERIDA',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'PERCENT',
      benefitValue: 10,
      conditions: []
    };
    const stay = evaluateRateRules([auto, sugerida], {
      layer: 'RATE',
      nights: 4,
      nightPrices: [264000, 264000, 264000, 264000],
      applySuggestedDefaults: true
    });
    const codes = stay.appliedRules.map((r) => r.code).sort();
    expect(codes).toEqual(['AUTO10', 'OPT_ON']);
    expect(stay.appliedRules.find((r) => r.code === 'OPT_ON').modality).toBe('SUGERIDA');
    expect(stay.discountARS).toBe(211200); // 10%+10% sobre bruto (independientes, tope bruto)
  });

  it('FREE_NIGHTS + PERCENT: ambas sobre bruto (sin cascada)', () => {
    const free = {
      id: 9,
      code: 'PROMO_4X3',
      label: '4x3',
      activo: true,
      prioridad: 100,
      modality: 'SUGERIDA',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'FREE_NIGHTS',
      benefitValue: 1,
      conditions: [{ type: 'NIGHTS', params: { op: 'gte', value: 4 } }]
    };
    const pct = {
      id: 10,
      code: 'AUTO10',
      label: 'Auto 10%',
      activo: true,
      prioridad: 90,
      modality: 'AUTO',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'PERCENT',
      benefitValue: 10,
      conditions: []
    };
    const prices = [264000, 264000, 264000, 264000]; // bruto 1.056.000
    const stay = evaluateRateRules([free, pct], {
      layer: 'RATE',
      nights: 4,
      nightPrices: prices,
      applySuggestedDefaults: true
    });
    expect(stay.originalARS).toBe(1056000);
    const freeRule = stay.appliedRules.find((r) => r.code === 'PROMO_4X3');
    const pctRule = stay.appliedRules.find((r) => r.code === 'AUTO10');
    expect(freeRule.montoARS).toBe(264000);
    // % sobre bruto completo (incl. noche gratis), no sobre subtotal post–free.
    expect(pctRule.montoARS).toBe(105600);
    expect(stay.discountARS).toBe(264000 + 105600);
    expect(stay.finalARS).toBe(1056000 - 264000 - 105600);
  });

  it('FREE_NIGHTS: benefitValue=noches gratis; mínimo pagadas vía NIGHTS', () => {
    const rule = {
      id: 30,
      code: 'UNA_NOCHE_GRATIS',
      label: '1 noche gratis (mín. 4 pagadas)',
      activo: true,
      prioridad: 100,
      modality: 'AUTO',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'FREE_NIGHTS',
      benefitValue: 1,
      // 4 pagadas + 1 gratis ⇒ estadía mínima 5 noches
      conditions: [{ type: 'NIGHTS', params: { op: 'gte', value: 5 } }]
    };

    expect(computeFreeNightCount(rule, 0)).toBe(0);
    expect(computeFreeNightCount(rule, 1)).toBe(1);
    expect(computeFreeNightCount(rule, 5)).toBe(1);
    expect(computeFreeNightCount({ ...rule, benefitValue: 2 }, 5)).toBe(2);
    expect(computeFreeNightCount({ ...rule, benefitValue: 9 }, 5)).toBe(5);
    expect(pickCheapestNightIndices([50000, 40000, 60000, 45000, 70000], 1)).toEqual([1]);

    const prices = [50000, 40000, 60000, 45000, 70000];
    const free = evaluateFreeNightsForStay([rule], { layer: 'RATE', nights: 5 }, prices);
    expect(free.aplica).toBe(true);
    expect(free.freeNightCount).toBe(1);
    expect(free.byIndex[1].finalARS).toBe(0);
    expect(free.byIndex[1].discountARS).toBe(40000);
    expect(free.discountARS).toBe(40000);

    const stay = evaluateRateRules([rule], {
      layer: 'RATE',
      nights: 5,
      nightPrices: prices
    });
    expect(stay.aplica).toBe(true);
    expect(stay.nights[1].freeNight).toBe(true);
    expect(stay.nights[1].finalARS).toBe(0);
    expect(stay.finalARS).toBe(50000 + 0 + 60000 + 45000 + 70000);

    const short = evaluateFreeNightsForStay([rule], { layer: 'RATE', nights: 4 }, [1, 2, 3, 4]);
    expect(short.aplica).toBe(false);

    // Promo 4x3: 1 noche gratis + NIGHTS>=4, modality SUGERIDA (default ON vía flag)
    const promo4x3 = {
      id: 9,
      code: 'PROMO_4X3',
      label: 'Promo 4x3',
      activo: true,
      prioridad: 100,
      modality: 'SUGERIDA',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'FREE_NIGHTS',
      benefitValue: 1,
      conditions: [{ type: 'NIGHTS', params: { op: 'gte', value: 4 } }]
    };
    const prices4 = [50000, 40000, 60000, 45000];
    const off = evaluateRateRules([promo4x3], {
      layer: 'RATE',
      nights: 4,
      nightPrices: prices4,
      selectedRuleIds: []
    });
    expect(off.aplica).toBe(false);
    expect(off.suggestions.some((s) => s.id === 9 && s.defaultOn)).toBe(true);

    const on = evaluateRateRules([promo4x3], {
      layer: 'RATE',
      nights: 4,
      nightPrices: prices4,
      selectedRuleIds: [],
      applySuggestedDefaults: true
    });
    expect(on.aplica).toBe(true);
    expect(on.freeNights.freeNightCount).toBe(1);
    expect(on.appliedRules).toHaveLength(1);
    expect(on.appliedRules[0].freeNightCount).toBe(1);
    expect(on.appliedRules[0].montoARS).toBe(40000);
    expect(on.freeNights.appliedRules[0].freeNightCount).toBe(1);
    expect(on.nights.filter((n) => n.freeNight)).toHaveLength(1);
    expect(on.nights[1].finalARS).toBe(0);
    expect(on.finalARS).toBe(50000 + 0 + 60000 + 45000);

    const twoFree = {
      ...rule,
      id: 31,
      benefitValue: 2,
      conditions: [{ type: 'NIGHTS', params: { op: 'gte', value: 6 } }]
    };
    const two = evaluateFreeNightsForStay([twoFree], { layer: 'RATE', nights: 6 }, [
      50000, 40000, 60000, 45000, 70000, 55000
    ]);
    expect(two.aplica).toBe(true);
    expect(two.freeNightCount).toBe(2);
    expect(two.byIndex[1].discountARS).toBe(40000);
    expect(two.byIndex[3].discountARS).toBe(45000);
    expect(two.discountARS).toBe(85000);
  });

  it('benefitValueManual: valor se define al aplicar vía benefitValueByRuleId', () => {
    const rule = {
      id: 40,
      code: 'CORTESIA',
      label: 'Cortesía %',
      activo: true,
      prioridad: 100,
      modality: 'MANUAL',
      layer: 'SETTLEMENT',
      stacking: 'EXCLUSIVE',
      benefitType: 'PERCENT',
      benefitValue: 0,
      benefitValueManual: true,
      benefitBase: 'DEBT_CANCELLED',
      aplicaEnParcial: true,
      aplicaEnSeña: true,
      conditions: []
    };

    expect(effectiveBenefitValue(rule, {})).toBeNull();
    expect(effectiveBenefitValue(rule, { benefitValueByRuleId: { 40: 15 } })).toBe(15);
    expect(withEffectiveBenefit(rule, { benefitValueByRuleId: { 40: 12 } }).benefitValue).toBe(12);

    const pending = evaluateSettlementRules([rule], {
      layer: 'SETTLEMENT',
      selectedRuleIds: [40],
      dineroARS: 10000,
      motivo: 'Cobro',
      mode: 'received'
    });
    expect(pending.aplica).toBe(false);
    expect(pending.suggestions.some((s) => s.id === 40 && s.benefitValueManual)).toBe(true);

    const applied = evaluateSettlementRules([rule], {
      layer: 'SETTLEMENT',
      selectedRuleIds: [40],
      benefitValueByRuleId: { 40: 10 },
      dineroARS: 9000,
      saldoPendiente: 100000,
      motivo: 'Cobro',
      mode: 'received'
    });
    expect(applied.aplica).toBe(true);
    expect(applied.dineroARS).toBe(9000);
    expect(applied.creditoARS).toBe(10000);
    expect(applied.descuentoARS).toBe(1000);
  });

  it('RATE stay: benefitValueManual no-FREE aparece en suggestions y aplica con override', () => {
    const rule = {
      id: 41,
      code: 'DTO_MANUAL',
      label: 'Dto % al aplicar',
      activo: true,
      prioridad: 100,
      modality: 'MANUAL',
      layer: 'RATE',
      stacking: 'EXCLUSIVE',
      benefitType: 'PERCENT',
      benefitValue: 0,
      benefitValueManual: true,
      benefitBase: 'RATE_NIGHT',
      conditions: []
    };

    const pending = evaluateRateRules([rule], {
      layer: 'RATE',
      nightPrices: [10000, 10000],
      nights: 2,
      selectedRuleIds: [],
      applySuggestedDefaults: true
    });
    expect(pending.aplica).toBe(false);
    expect(pending.suggestions.some((s) => s.id === 41 && s.benefitValueManual)).toBe(true);

    const applied = evaluateRateRules([rule], {
      layer: 'RATE',
      nightPrices: [10000, 10000],
      nights: 2,
      selectedRuleIds: [41],
      benefitValueByRuleId: { 41: 10 },
      applySuggestedDefaults: true
    });
    expect(applied.aplica).toBe(true);
    expect(applied.discountARS).toBe(2000);
    expect(applied.finalARS).toBe(18000);
  });
});
