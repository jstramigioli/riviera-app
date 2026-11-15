const {
  mergeContiguousServicePeriods,
  buildMergedAvailablePeriods
} = require('../../src/utils/serviceAvailabilityPeriods');

describe('serviceAvailabilityPeriods', () => {
  it('mergeContiguousServicePeriods une fin de bloque 24 + inicio 25 (half-open)', () => {
    const merged = mergeContiguousServicePeriods([
      { startDate: '2026-12-21', endDate: '2026-12-25', blockName: 'Valor C' },
      { startDate: '2026-12-25', endDate: '2026-12-30', blockName: 'Valor B' }
    ]);
    expect(merged).toEqual([
      {
        startDate: '2026-12-21',
        endDate: '2026-12-30',
        blockName: 'Valor C + Valor B'
      }
    ]);
  });

  it('mergeContiguousServicePeriods no une si hay hueco real de servicio', () => {
    const merged = mergeContiguousServicePeriods([
      { startDate: '2026-12-04', endDate: '2026-12-18', blockName: 'A' },
      { startDate: '2026-12-21', endDate: '2026-12-30', blockName: 'B' }
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].endDate).toBe('2026-12-18');
    expect(merged[1].startDate).toBe('2026-12-21');
  });

  it('buildMergedAvailablePeriods: media pensión 4–30 → un tramo 21–30 (no parte 24/25)', () => {
    const periods = buildMergedAvailablePeriods(
      { checkIn: '2026-12-04', checkOut: '2026-12-30' },
      [
        {
          name: '2026/27 · Valor C (navidad)',
          startDate: '2026-12-21',
          endDate: '2026-12-24'
        },
        {
          name: '2026/27 · Valor B (fin de año)',
          startDate: '2026-12-25',
          endDate: '2027-01-07'
        }
      ]
    );
    expect(periods).toEqual([
      {
        startDate: '2026-12-21',
        endDate: '2026-12-30',
        blockName:
          '2026/27 · Valor C (navidad) + 2026/27 · Valor B (fin de año)'
      }
    ]);
  });

  it('buildMergedAvailablePeriods: desayuno en todos los bloques → un solo período', () => {
    const periods = buildMergedAvailablePeriods(
      { checkIn: '2026-12-04', checkOut: '2026-12-30' },
      [
        { name: 'D', startDate: '2026-12-04', endDate: '2026-12-17' },
        { name: 'C sin cena', startDate: '2026-12-18', endDate: '2026-12-20' },
        { name: 'C', startDate: '2026-12-21', endDate: '2026-12-24' },
        { name: 'B', startDate: '2026-12-25', endDate: '2027-01-07' }
      ]
    );
    expect(periods).toEqual([
      {
        startDate: '2026-12-04',
        endDate: '2026-12-30',
        blockName: 'D + C sin cena + C + B'
      }
    ]);
  });
});
