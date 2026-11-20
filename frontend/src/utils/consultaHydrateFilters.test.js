import { describe, expect, it } from 'vitest';
import {
  filtersFromLoadedGuests,
  guestSourceFromQuery
} from './consultaHydrateFilters';

describe('guestSourceFromQuery', () => {
  it('usa el primer segmento en multi-segmento', () => {
    const source = guestSourceFromQuery({
      isMultiSegment: true,
      requiredGuests: 1,
      segments: [
        { requiredGuests: 2, requiredTags: ['vista'] },
        { requiredGuests: 3 }
      ]
    });
    expect(source.requiredGuests).toBe(2);
    expect(source.requiredTags).toEqual(['vista']);
  });

  it('usa la query raíz en legacy single', () => {
    const source = guestSourceFromQuery({
      isMultiSegment: false,
      requiredGuests: 4
    });
    expect(source.requiredGuests).toBe(4);
  });
});

describe('filtersFromLoadedGuests', () => {
  it('sincroniza huéspedes al filtro (caso 2 → no queda 1)', () => {
    const filters = filtersFromLoadedGuests({ requiredGuests: 2 });
    expect(filters.requiredGuests).toBe(2);
  });

  it('acepta guestCount (reservas) como fallback', () => {
    expect(filtersFromLoadedGuests({ guestCount: 3 }).requiredGuests).toBe(3);
  });

  it('default 1 si falta o es inválido', () => {
    expect(filtersFromLoadedGuests({}).requiredGuests).toBe(1);
    expect(filtersFromLoadedGuests({ requiredGuests: 0 }).requiredGuests).toBe(1);
    expect(filtersFromLoadedGuests({ requiredGuests: 'x' }).requiredGuests).toBe(1);
  });

  it('incluye tags y preferencia de camas', () => {
    const filters = filtersFromLoadedGuests({
      requiredGuests: 2,
      requiredTags: ['doble'],
      preferredDoubleBeds: 1,
      preferredSingleBeds: 0,
      bedPreferenceNone: false
    });
    expect(filters.requiredTags).toEqual(['doble']);
    expect(filters.preferredDoubleBeds).toBe(1);
    expect(filters.bedPreferenceNone).toBe(false);
  });
});
