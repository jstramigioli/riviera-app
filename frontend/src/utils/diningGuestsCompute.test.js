import { describe, expect, it } from 'vitest';
import { mealFlagsFromServiceRef, sumAgendaTotals } from './diningGuestsCompute';

describe('diningGuestsCompute (frontend mirror)', () => {
  it('no marca cena en solo alojamiento / desayuno; sí en media pensión', () => {
    expect(mealFlagsFromServiceRef('solo_alojamiento').dinner).toBe(false);
    expect(mealFlagsFromServiceRef('con_desayuno').dinner).toBe(false);
    expect(mealFlagsFromServiceRef('media_pension').dinner).toBe(true);
  });

  it('suma totales de agenda del API sin recalcular', () => {
    expect(
      sumAgendaTotals({
        totals: { mediaPension: 3, additional: 2, external: 5, total: 10 }
      })
    ).toEqual({
      mediaPension: 3,
      additional: 2,
      external: 5,
      total: 10
    });
  });
});
