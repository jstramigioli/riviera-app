import { describe, it, expect } from 'vitest';
import { groupClientQueries } from './groupClientQueries';

describe('groupClientQueries', () => {
  it('deja standalone sin queryGroupId', () => {
    const result = groupClientQueries([
      { id: 1, updatedAt: '2026-01-02T00:00:00.000Z', checkIn: '2026-02-01', checkOut: '2026-02-03' }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].isMultiSegment).toBeUndefined();
  });

  it('agrupa segmentos del mismo queryGroupId en una sola entrada', () => {
    const result = groupClientQueries([
      {
        id: 10,
        queryGroupId: 'g1',
        segmentIndex: 0,
        checkIn: '2026-03-01',
        checkOut: '2026-03-03',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 11,
        queryGroupId: 'g1',
        segmentIndex: 1,
        checkIn: '2026-03-03',
        checkOut: '2026-03-05',
        updatedAt: '2026-01-05T00:00:00.000Z'
      }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
    expect(result[0].queryGroupId).toBe('g1');
    expect(result[0].isMultiSegment).toBe(true);
    expect(result[0].segmentCount).toBe(2);
    expect(result[0].checkIn).toBe('2026-03-01');
    expect(result[0].checkOut).toBe('2026-03-05');
    expect(result[0].updatedAt).toBe('2026-01-05T00:00:00.000Z');
  });

  it('ordena por updatedAt descendente', () => {
    const result = groupClientQueries([
      { id: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      {
        id: 2,
        queryGroupId: 'g2',
        segmentIndex: 0,
        checkIn: 'a',
        checkOut: 'b',
        updatedAt: '2026-02-01T00:00:00.000Z'
      }
    ]);
    expect(result.map((q) => q.id)).toEqual([2, 1]);
  });
});
