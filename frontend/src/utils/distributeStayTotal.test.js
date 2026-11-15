import { applyDistributedTotalsToNights, distributeStayTotal } from './distributeStayTotal';

describe('distributeStayTotal', () => {
  it('reparte exacto sin resto', () => {
    expect(distributeStayTotal(30000, 3)).toEqual([10000, 10000, 10000]);
  });

  it('reparte centavos restantes a las primeras noches', () => {
    expect(distributeStayTotal(10000, 3)).toEqual([3333.34, 3333.33, 3333.33]);
    const sum = distributeStayTotal(10000, 3).reduce((a, b) => a + b, 0);
    expect(Number(sum.toFixed(2))).toBe(10000);
  });

  it('total 0 → ceros', () => {
    expect(distributeStayTotal(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('sin noches → []', () => {
    expect(distributeStayTotal(1000, 0)).toEqual([]);
  });

  it('applyDistributedTotalsToNights marca manualOverride', () => {
    const nights = applyDistributedTotalsToNights(
      [{ date: '2026-12-01' }, { date: '2026-12-02' }],
      100.01
    );
    expect(nights.map((n) => n.finalARS)).toEqual([50.01, 50]);
    expect(nights.every((n) => n.manualOverride)).toBe(true);
  });
});
