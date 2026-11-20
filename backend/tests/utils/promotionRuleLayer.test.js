const { resolveLayerAndBenefitBase } = require('../../src/utils/promotionRuleLayer');

describe('resolveLayerAndBenefitBase', () => {
  it('PROMO PERCENT → RATE (sin condiciones, Consulta)', () => {
    expect(
      resolveLayerAndBenefitBase({
        kind: 'PROMO',
        benefitType: 'PERCENT',
        layer: 'SETTLEMENT',
        benefitBase: 'DEBT_CANCELLED'
      })
    ).toEqual({ layer: 'RATE', benefitBase: 'RATE_NIGHT' });
  });

  it('FREE_NIGHTS → RATE aunque kind sea DESCUENTO', () => {
    expect(
      resolveLayerAndBenefitBase({
        kind: 'DESCUENTO',
        benefitType: 'FREE_NIGHTS',
        layer: 'SETTLEMENT'
      })
    ).toEqual({ layer: 'RATE', benefitBase: 'RATE_NIGHT' });
  });

  it('DESCUENTO PERCENT → SETTLEMENT (efectivo / caja)', () => {
    expect(
      resolveLayerAndBenefitBase({
        kind: 'DESCUENTO',
        benefitType: 'PERCENT',
        layer: 'SETTLEMENT',
        benefitBase: 'DEBT_CANCELLED'
      })
    ).toEqual({ layer: 'SETTLEMENT', benefitBase: 'DEBT_CANCELLED' });
  });
});
