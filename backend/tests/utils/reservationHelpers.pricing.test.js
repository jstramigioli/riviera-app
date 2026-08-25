const { expandSegmentNightRates } = require('../../src/utils/reservationHelpers');

describe('expandSegmentNightRates', () => {
  test('expande tarifa plana noche a noche', () => {
    const nights = expandSegmentNightRates({
      startDate: '2026-01-10',
      endDate: '2026-01-13',
      baseRate: 100,
      listRate: 120,
      services: ['svc-1']
    });

    expect(nights).toHaveLength(3);
    expect(nights[0].date).toBe('2026-01-10');
    expect(nights[2].date).toBe('2026-01-12');
    expect(nights.every((n) => n.finalRate === 100)).toBe(true);
    expect(nights.every((n) => n.listRate === 120)).toBe(true);
  });

  test('respeta nightRates del payload y override manual', () => {
    const nights = expandSegmentNightRates({
      startDate: '2026-01-10',
      endDate: '2026-01-12',
      baseRate: 80,
      isManualRate: true,
      services: ['svc-1'],
      nightRates: [
        { date: '2026-01-10', listRate: 100, finalRate: 80, seasonBlockId: 'b1' },
        { date: '2026-01-11', listRate: 150, finalRate: 80, seasonBlockId: 'b2' }
      ]
    });

    expect(nights).toHaveLength(2);
    expect(nights[0].seasonBlockId).toBe('b1');
    expect(nights[1].listRate).toBe(150);
    expect(nights[1].manualOverride).toBe(true);
  });
});
