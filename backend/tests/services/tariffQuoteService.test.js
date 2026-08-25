const {
  groupIntoProposedSegments,
  formatDateOnly,
  parseDateOnly,
  addDays,
  getEnabledServicesForBlock
} = require('../../src/services/tariffQuoteService');

describe('tariffQuoteService helpers', () => {
  test('agrupa noches consecutivas del mismo servicio', () => {
    const nights = [
      { date: '2026-01-10', status: 'ok', serviceTypeId: 'desayuno', listRate: 100, seasonBlockId: 'a', blockName: 'A' },
      { date: '2026-01-11', status: 'ok', serviceTypeId: 'desayuno', listRate: 100, seasonBlockId: 'a', blockName: 'A' },
      { date: '2026-01-12', status: 'ok', serviceTypeId: 'media', listRate: 150, seasonBlockId: 'b', blockName: 'B' }
    ];

    const segments = groupIntoProposedSegments(nights);
    expect(segments).toHaveLength(2);
    expect(segments[0].checkIn).toBe('2026-01-10');
    expect(segments[0].checkOut).toBe('2026-01-12');
    expect(segments[0].serviceTypeId).toBe('desayuno');
    expect(segments[0].numberOfNights).toBe(2);
    expect(segments[1].serviceTypeId).toBe('media');
    expect(segments[1].checkIn).toBe('2026-01-12');
    expect(segments[1].checkOut).toBe('2026-01-13');
  });

  test('marca variableRate si el precio cambia dentro del mismo servicio', () => {
    const nights = [
      { date: '2026-01-10', status: 'ok', serviceTypeId: 'media', listRate: 100, seasonBlockId: 'a', blockName: 'A' },
      { date: '2026-01-11', status: 'ok', serviceTypeId: 'media', listRate: 200, seasonBlockId: 'b', blockName: 'B' }
    ];
    const segments = groupIntoProposedSegments(nights);
    expect(segments).toHaveLength(1);
    expect(segments[0].variableRate).toBe(true);
    expect(segments[0].crossesBlocks).toBe(true);
    expect(segments[0].totalAmount).toBe(300);
  });

  test('parse/format date helpers son estables', () => {
    const d = parseDateOnly('2026-12-05');
    expect(formatDateOnly(d)).toBe('2026-12-05');
    expect(formatDateOnly(addDays(d, 1))).toBe('2026-12-06');
  });

  test('getEnabledServicesForBlock usa selecciones cuando useBlockServices', () => {
    const block = {
      useBlockServices: true,
      blockServiceSelections: [
        { isEnabled: true, orderIndex: 2, serviceType: { id: 'b', name: 'B', orderIndex: 2 } },
        { isEnabled: false, orderIndex: 1, serviceType: { id: 'a', name: 'A', orderIndex: 1 } },
        { isEnabled: true, orderIndex: 1, serviceType: { id: 'c', name: 'C', orderIndex: 1 } }
      ],
      seasonPrices: []
    };
    const services = getEnabledServicesForBlock(block);
    expect(services.map((s) => s.id)).toEqual(['c', 'b']);
  });
});
