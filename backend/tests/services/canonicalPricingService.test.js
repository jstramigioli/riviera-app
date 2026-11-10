const {
  calculateFinalPrice,
  blockCoversDate
} = require('../../src/services/canonicalPricingService');

describe('canonicalPricingService', () => {
  test('calculateFinalPrice aplica % sin redondeo', () => {
    const priced = calculateFinalPrice(1000, 10);
    expect(priced.calculatedPrice).toBe(1100);
    expect(priced.finalPrice).toBe(1100);
    expect(priced.wasRounded).toBe(false);
    expect(priced.currency).toBe('ARS');
  });

  test('calculateFinalPrice sin ajuste conserva el precio exacto', () => {
    const priced = calculateFinalPrice(999, 0);
    expect(priced.finalPrice).toBe(999);
    expect(priced.wasRounded).toBe(false);
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
