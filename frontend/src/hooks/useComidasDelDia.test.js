import { describe, expect, it } from 'vitest';
import { mapComidasResponse } from './useComidasDelDia';

describe('mapComidasResponse', () => {
  it('adapta /api/comidas a totales e ítems del dashboard', () => {
    const result = mapComidasResponse({
      desayunos: {
        total: 2,
        items: [
          {
            id: 1,
            reservationId: 40,
            clientId: 7,
            roomLabel: '12',
            guestName: 'Ana Pérez',
            pax: 2,
            origen: 'REGIMEN',
            label: '12 - Ana Pérez (2)'
          }
        ]
      },
      cenas: { total: 0, items: [] }
    });
    expect(result.breakfastGuests).toBe(2);
    expect(result.dinnerGuests).toBe(0);
    expect(result.breakfastItems[0]).toMatchObject({
      reservationId: 40,
      clientId: 7,
      roomLabel: '12',
      guestName: 'Ana Pérez',
      guests: 2,
      label: '12 - Ana Pérez (2)'
    });
    expect(result.dinnerItems).toEqual([]);
  });

  it('tolera respuestas vacías', () => {
    expect(mapComidasResponse(null)).toEqual({
      breakfastGuests: 0,
      dinnerGuests: 0,
      breakfastItems: [],
      dinnerItems: []
    });
  });
});
