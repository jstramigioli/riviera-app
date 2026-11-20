import { buildStayNightPlan } from './stayPromoPreview';

describe('buildStayNightPlan', () => {
  it('aplana segmentos en un solo tramo ordenado', () => {
    const plan = buildStayNightPlan([
      {
        segmentIndex: 0,
        checkIn: '2026-03-01',
        checkOut: '2026-03-03',
        roomTypeId: 1,
        serviceTypeId: 'con_desayuno',
        subtotal: 200,
        nights: [
          { date: '2026-03-01', originalARS: 100 },
          { date: '2026-03-02', originalARS: 100 }
        ]
      },
      {
        segmentIndex: 1,
        checkIn: '2026-03-03',
        checkOut: '2026-03-05',
        roomTypeId: 2,
        serviceTypeId: 'con_desayuno',
        subtotal: 240,
        nights: [
          { date: '2026-03-03', originalARS: 120 },
          { date: '2026-03-04', originalARS: 120 }
        ]
      }
    ]);

    expect(plan.nightPrices).toEqual([100, 100, 120, 120]);
    expect(plan.checkIn).toBe('2026-03-01');
    expect(plan.checkOut).toBe('2026-03-05');
    expect(plan.subtotal).toBe(440);
    expect(plan.offsets).toEqual([
      { segmentIndex: 0, start: 0, end: 2, subtotal: 200 },
      { segmentIndex: 1, start: 2, end: 4, subtotal: 240 }
    ]);
    expect(plan.nights.map((n) => n.segmentIndex)).toEqual([0, 0, 1, 1]);
  });
});
