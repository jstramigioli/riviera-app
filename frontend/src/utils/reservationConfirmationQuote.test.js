import { describe, expect, it } from 'vitest';
import {
  buildDraftReservationForTimeline,
  collectSegmentNights,
  flattenPreviewAppliedRules,
  mergeNightsWithPreview,
  nightPriceFromRate,
  summarizeConfirmationQuote
} from './reservationConfirmationQuote';

describe('reservationConfirmationQuote', () => {
  it('nightPriceFromRate prioriza serviceRate', () => {
    expect(nightPriceFromRate({ baseRate: 100, serviceRate: 150, finalRate: 140 })).toBe(150);
  });

  it('collectSegmentNights arma precios por noche desde ratesData', () => {
    const segments = [{ checkIn: '2026-12-01', checkOut: '2026-12-03', serviceType: 'svc-1' }];
    const rooms = [
      {
        name: '101',
        roomType: { id: 2, name: 'Doble' },
        ratesData: {
          totalAmount: 300,
          rates: [
            { date: '2026-12-01', serviceRate: 100 },
            { date: '2026-12-02', serviceRate: 200 }
          ]
        }
      }
    ];
    const [seg] = collectSegmentNights(segments, rooms);
    expect(seg.nightPrices).toEqual([100, 200]);
    expect(seg.subtotal).toBe(300);
    expect(seg.roomTypeId).toBe(2);
  });

  it('buildDraftReservationForTimeline mapea segmentos y total', () => {
    const draft = buildDraftReservationForTimeline({
      mainClient: { id: 9, firstName: 'Ana', lastName: 'Pérez' },
      totalAmount: 4500,
      segments: [
        {
          checkIn: '2026-12-01',
          checkOut: '2026-12-03',
          requiredGuests: 2,
          serviceType: 'desayuno',
          requiredRoomId: 5
        }
      ],
      selectedRoomsPerBlock: [
        { id: 11, name: '201', roomType: { name: 'Triple' }, ratesData: { averageRatePerNight: 2250 } }
      ]
    });
    expect(draft.mainClient.id).toBe(9);
    expect(draft.totalAmount).toBe(4500);
    expect(draft.segments[0].room.name).toBe('201');
    expect(draft.segments[0].requiredRoomId).toBe(5);
    expect(draft.segments[0].services).toEqual(['desayuno']);
  });

  it('flattenPreviewAppliedRules agrega free nights y reglas por noche', () => {
    const rules = flattenPreviewAppliedRules({
      appliedRules: [],
      freeNights: {
        appliedRules: [
          { promotionRuleId: 1, code: 'FREE1', label: 'Noche gratis', montoARS: 200, freeNightCount: 1 }
        ]
      },
      nights: [
        {
          nightIndex: 0,
          appliedRules: [{ promotionRuleId: 2, code: 'PCT10', label: '10%', montoARS: 50, porcentaje: 10 }]
        },
        {
          nightIndex: 1,
          appliedRules: [{ promotionRuleId: 2, code: 'PCT10', label: '10%', montoARS: 40, porcentaje: 10 }]
        }
      ]
    });
    expect(rules).toHaveLength(2);
    const pct = rules.find((r) => r.code === 'PCT10');
    expect(pct.montoARS).toBe(90);
    const free = rules.find((r) => r.code === 'FREE1');
    expect(free.freeNightCount).toBe(1);
  });

  it('flattenPreviewAppliedRules no duplica PERCENT top + nights', () => {
    const rules = flattenPreviewAppliedRules({
      discountARS: 105600,
      appliedRules: [
        {
          promotionRuleId: 10,
          code: 'AUTO10',
          label: '10%',
          montoARS: 105600,
          porcentaje: 10,
          benefitType: 'PERCENT'
        }
      ],
      freeNights: { appliedRules: [] },
      nights: [
        {
          nightIndex: 0,
          appliedRules: [
            { promotionRuleId: 10, code: 'AUTO10', label: '10%', montoARS: 26400, porcentaje: 10 }
          ]
        },
        {
          nightIndex: 1,
          appliedRules: [
            { promotionRuleId: 10, code: 'AUTO10', label: '10%', montoARS: 26400, porcentaje: 10 }
          ]
        }
      ]
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].montoARS).toBe(105600);
  });

  it('flattenPreviewAppliedRules no duplica FREE_NIGHTS cuando top espeja freeNights', () => {
    const freeRule = {
      promotionRuleId: 99,
      code: 'PROMO_4X3',
      label: '4x3',
      benefitType: 'FREE_NIGHTS',
      benefitValue: 1,
      freeNightCount: 1,
      montoARS: 50000
    };
    const rules = flattenPreviewAppliedRules({
      appliedRules: [freeRule],
      freeNights: { appliedRules: [freeRule], freeNightCount: 1 },
      nights: [
        { nightIndex: 0, discountARS: 50000, finalARS: 0, freeNight: true },
        { nightIndex: 1, discountARS: 0, finalARS: 50000, freeNight: false }
      ]
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].freeNightCount).toBe(1);
    expect(rules[0].montoARS).toBe(50000);
  });

  it('mergeNightsWithPreview y summarizeConfirmationQuote calculan total', () => {
    const nights = [
      { nightIndex: 0, date: '2026-12-01', dateLabel: '01/12/2026', originalARS: 100 },
      { nightIndex: 1, date: '2026-12-02', dateLabel: '02/12/2026', originalARS: 200 }
    ];
    const merged = mergeNightsWithPreview(nights, {
      nights: [
        { nightIndex: 0, discountARS: 10, finalARS: 90 },
        { nightIndex: 1, discountARS: 200, finalARS: 0, freeNight: true }
      ]
    });
    expect(merged[0].finalARS).toBe(90);
    expect(merged[1].freeNight).toBe(true);

    const summary = summarizeConfirmationQuote([
      {
        subtotal: 300,
        discountARS: 210,
        nights: merged,
        promos: [{ promotionRuleId: 1, code: 'X', label: 'Promo', montoARS: 210 }]
      }
    ]);
    expect(summary.subtotalARS).toBe(300);
    expect(summary.discountARS).toBe(210);
    expect(summary.totalARS).toBe(90);
    expect(summary.hasPromos).toBe(true);
  });
});
