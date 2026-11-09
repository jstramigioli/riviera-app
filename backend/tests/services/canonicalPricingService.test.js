const {
  applyRounding,
  calculateFinalPrice,
  blockCoversDate
} = require('../../src/services/canonicalPricingService');

describe('canonicalPricingService', () => {
  test('applyRounding nearest/ceil/floor', () => {
    expect(applyRounding(103, { multiple: 10, mode: 'nearest' })).toBe(100);
    expect(applyRounding(105, { multiple: 10, mode: 'nearest' })).toBe(110);
    expect(applyRounding(101, { multiple: 10, mode: 'ceil' })).toBe(110);
    expect(applyRounding(109, { multiple: 10, mode: 'floor' })).toBe(100);
  });

  test('calculateFinalPrice aplica % y redondeo', () => {
    const priced = calculateFinalPrice(1000, 10, { multiple: 50, mode: 'nearest' });
    expect(priced.calculatedPrice).toBe(1100);
    expect(priced.finalPrice).toBe(1100);
    expect(priced.currency).toBe('ARS');
  });

  test('calculateFinalPrice sin ajuste', () => {
    const priced = calculateFinalPrice(999, 0, { multiple: 10, mode: 'ceil' });
    expect(priced.finalPrice).toBe(1000);
  });

  test('blockCoversDate compara por día calendario', () => {
    const block = {
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T00:00:00.000Z')
    };
    expect(blockCoversDate(block, new Date('2026-01-15T12:00:00.000Z'))).toBe(true);
    expect(blockCoversDate(block, new Date('2026-02-01T12:00:00.000Z'))).toBe(false);
  });
});
