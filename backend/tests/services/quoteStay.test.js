const { quoteStay } = require('../../src/services/tariffQuoteService');

function mockPrisma(blocks) {
  return {
    seasonBlock: {
      findMany: jest.fn().mockResolvedValue(blocks)
    }
  };
}

describe('quoteStay', () => {
  const breakfast = { id: 'svc-bf', name: 'Con desayuno', orderIndex: 1 };
  const half = { id: 'svc-hb', name: 'Desayuno y cena', orderIndex: 2 };

  test('solo usa bloques confirmados y cotiza noche a noche', async () => {
    const blocks = [
      {
        id: 'block-1',
        name: '5-20 dic',
        startDate: new Date('2026-12-05T00:00:00'),
        endDate: new Date('2026-12-20T00:00:00'),
        isDraft: false,
        useBlockServices: true,
        blockServiceSelections: [
          { isEnabled: true, orderIndex: 1, serviceType: breakfast },
          { isEnabled: true, orderIndex: 2, serviceType: half }
        ],
        seasonPrices: [
          { roomTypeId: 1, serviceTypeId: breakfast.id, basePrice: 10000, isDraft: false, serviceType: breakfast },
          { roomTypeId: 1, serviceTypeId: half.id, basePrice: 15000, isDraft: false, serviceType: half }
        ]
      }
    ];

    const result = await quoteStay({
      prisma: mockPrisma(blocks),
      hotelId: 'default-hotel',
      roomTypeId: 1,
      startDate: '2026-12-10',
      endDate: '2026-12-12',
      serviceTypeId: breakfast.id
    });

    expect(result.availability).toBe('success');
    expect(result.numberOfNights).toBe(2);
    expect(result.totalAmount).toBe(20000);
    expect(result.rates[0].seasonBlockId).toBe('block-1');
  });

  test('marca closed si hay noches sin tramo', async () => {
    const blocks = [
      {
        id: 'block-1',
        name: 'finde',
        startDate: new Date('2026-10-12T00:00:00'),
        endDate: new Date('2026-10-14T00:00:00'),
        isDraft: false,
        useBlockServices: true,
        blockServiceSelections: [
          { isEnabled: true, orderIndex: 1, serviceType: half }
        ],
        seasonPrices: [
          { roomTypeId: 1, serviceTypeId: half.id, basePrice: 20000, isDraft: false, serviceType: half }
        ]
      }
    ];

    const result = await quoteStay({
      prisma: mockPrisma(blocks),
      hotelId: 'default-hotel',
      roomTypeId: 1,
      startDate: '2026-10-12',
      endDate: '2026-10-16',
      serviceTypeId: half.id
    });

    expect(result.availability).toBe('closed');
    expect(result.closedDates).toContain('2026-10-15');
  });

  test('partial_availability propone segmentos con servicio alternativo', async () => {
    const blocks = [
      {
        id: 'pre',
        name: 'pre-pico',
        startDate: new Date('2026-01-10T00:00:00'),
        endDate: new Date('2026-01-14T00:00:00'),
        isDraft: false,
        useBlockServices: true,
        blockServiceSelections: [
          { isEnabled: true, orderIndex: 1, serviceType: breakfast },
          { isEnabled: true, orderIndex: 2, serviceType: half }
        ],
        seasonPrices: [
          { roomTypeId: 1, serviceTypeId: breakfast.id, basePrice: 10000, isDraft: false, serviceType: breakfast },
          { roomTypeId: 1, serviceTypeId: half.id, basePrice: 14000, isDraft: false, serviceType: half }
        ]
      },
      {
        id: 'pico',
        name: 'pico',
        startDate: new Date('2026-01-15T00:00:00'),
        endDate: new Date('2026-01-20T00:00:00'),
        isDraft: false,
        useBlockServices: true,
        blockServiceSelections: [
          { isEnabled: false, orderIndex: 1, serviceType: breakfast },
          { isEnabled: true, orderIndex: 2, serviceType: half }
        ],
        seasonPrices: [
          { roomTypeId: 1, serviceTypeId: half.id, basePrice: 20000, isDraft: false, serviceType: half }
        ]
      }
    ];

    const result = await quoteStay({
      prisma: mockPrisma(blocks),
      hotelId: 'default-hotel',
      roomTypeId: 1,
      startDate: '2026-01-12',
      endDate: '2026-01-17',
      serviceTypeId: breakfast.id
    });

    expect(result.availability).toBe('partial_availability');
    expect(result.suggestedSegments.length).toBeGreaterThanOrEqual(2);
    const okSeg = result.suggestedSegments.find((s) => s.status === 'ok');
    const altSeg = result.suggestedSegments.find((s) => s.status === 'service_unavailable');
    expect(okSeg?.serviceTypeId).toBe(breakfast.id);
    expect(altSeg?.serviceTypeId).toBe(half.id);
  });
});
