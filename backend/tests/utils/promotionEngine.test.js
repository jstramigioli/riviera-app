const {
  evaluateCondition,
  ruleMatchesConditions,
  evaluateSettlementRules,
  evaluateRateRules,
  applyRateBenefit,
  selectByStacking,
  isRuleVigente
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
      motivo: 'Pago',
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
      motivo: 'Pago',
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
});
