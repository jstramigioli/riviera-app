import { describe, it, expect } from 'vitest';
import {
  defaultBedsForCapacity,
  validateBedsAgainstCapacity,
  roomCanSatisfyBedPreference,
  normalizeBedPreference,
  totalBedCapacity,
  countBedsByType,
  maxSingleBedsFromConfig,
  maxBedPreferenceLimits,
  clampBedPreferenceToLimits,
  bedPreferencePlazas,
  bedPreferenceOptionExceedsGuests
} from './bedConfig';

describe('bedConfig', () => {
  it('defaults por capacidad: triple = 1 double + 1 single', () => {
    const beds = defaultBedsForCapacity(3);
    expect(totalBedCapacity(beds)).toBe(3);
    expect(beds.filter((b) => b.bedType === 'double')).toHaveLength(1);
    expect(beds.filter((b) => b.bedType === 'single')).toHaveLength(1);
  });

  it('rechaza 4 singles en tipo triple', () => {
    const beds = [
      { bedType: 'single' },
      { bedType: 'single' },
      { bedType: 'single' },
      { bedType: 'single' }
    ];
    const result = validateBedsAgainstCapacity(beds, 3);
    expect(result.ok).toBe(false);
    expect(result.capacity).toBe(4);
  });

  it('rechaza 2 doubles en tipo triple', () => {
    const beds = [{ bedType: 'double' }, { bedType: 'double' }];
    const result = validateBedsAgainstCapacity(beds, 3);
    expect(result.ok).toBe(false);
    expect(result.capacity).toBe(4);
  });

  it('sin preferencia siempre cumple', () => {
    const result = roomCanSatisfyBedPreference(
      [{ bedType: 'single' }],
      { bedPreferenceNone: true }
    );
    expect(result.complies).toBe(true);
  });

  it('matrimonial separable cubre 2 individuales', () => {
    const beds = [{ bedType: 'double', isSeparable: true }];
    const result = roomCanSatisfyBedPreference(beds, {
      bedPreferenceNone: false,
      preferredDoubleBeds: 0,
      preferredSingleBeds: 2
    });
    expect(result.complies).toBe(true);
  });

  it('matrimonial no separable no cubre 2 individuales', () => {
    const beds = [{ bedType: 'double', isSeparable: false }];
    const result = roomCanSatisfyBedPreference(beds, {
      bedPreferenceNone: false,
      preferredDoubleBeds: 0,
      preferredSingleBeds: 2
    });
    expect(result.complies).toBe(false);
  });

  it('mixta: 1 double separable + 1 single puede dar 1 double + 1 single', () => {
    const beds = [
      { bedType: 'double', isSeparable: true },
      { bedType: 'single' }
    ];
    expect(
      roomCanSatisfyBedPreference(beds, {
        bedPreferenceNone: false,
        preferredDoubleBeds: 1,
        preferredSingleBeds: 1
      }).complies
    ).toBe(true);
  });

  it('mixta: no puede dar 3 individuales si usa el double como double', () => {
    const beds = [
      { bedType: 'double', isSeparable: true },
      { bedType: 'single' }
    ];
    // Pide 0 matrimoniales + 3 individuales → sep como 2 + 1 single = 3 OK
    expect(
      roomCanSatisfyBedPreference(beds, {
        bedPreferenceNone: false,
        preferredDoubleBeds: 0,
        preferredSingleBeds: 3
      }).complies
    ).toBe(true);
    // Pide 1 matrimonial + 3 individuales → imposible
    expect(
      roomCanSatisfyBedPreference(beds, {
        bedPreferenceNone: false,
        preferredDoubleBeds: 1,
        preferredSingleBeds: 3
      }).complies
    ).toBe(false);
  });

  it('normalizeBedPreference: sin preferencia por defecto', () => {
    expect(normalizeBedPreference({}).bedPreferenceNone).toBe(true);
    expect(
      normalizeBedPreference({
        bedPreferenceNone: false,
        preferredDoubleBeds: 1,
        preferredSingleBeds: 0
      })
    ).toEqual({
      bedPreferenceNone: false,
      preferredDoubleBeds: 1,
      preferredSingleBeds: 0
    });
  });

  it('countBedsByType cuenta double y single', () => {
    expect(
      countBedsByType([
        { bedType: 'double' },
        { bedType: 'double' },
        { bedType: 'single' }
      ])
    ).toEqual({ double: 2, single: 1 });
  });

  it('maxSingleBedsFromConfig: doble separable = 2 individuales', () => {
    expect(maxSingleBedsFromConfig([{ bedType: 'double', isSeparable: true }])).toBe(2);
    expect(maxSingleBedsFromConfig([{ bedType: 'double', isSeparable: false }])).toBe(0);
    expect(
      maxSingleBedsFromConfig([
        { bedType: 'double', isSeparable: true },
        { bedType: 'single' }
      ])
    ).toBe(3);
  });

  it('maxBedPreferenceLimits: max Mat/Ind entre habitaciones con capacidad = huéspedes', () => {
    const rooms = [
      {
        id: 1,
        maxPeople: 2,
        beds: [{ bedType: 'double' }]
      },
      {
        id: 2,
        maxPeople: 2,
        beds: [{ bedType: 'single' }, { bedType: 'single' }]
      },
      {
        id: 3,
        maxPeople: 4,
        beds: [
          { bedType: 'double' },
          { bedType: 'double' },
          { bedType: 'single' },
          { bedType: 'single' }
        ]
      }
    ];
    expect(maxBedPreferenceLimits(rooms, 2)).toEqual({
      maxDoubleBeds: 1,
      maxSingleBeds: 2
    });
    expect(maxBedPreferenceLimits(rooms, 4)).toEqual({
      maxDoubleBeds: 2,
      maxSingleBeds: 2
    });
    expect(maxBedPreferenceLimits(rooms, 3)).toEqual({
      maxDoubleBeds: 0,
      maxSingleBeds: 0
    });
  });

  it('maxBedPreferenceLimits: doble separable suma 2 al máximo Ind', () => {
    const rooms = [
      {
        id: 1,
        maxPeople: 2,
        beds: [{ bedType: 'double', isSeparable: true }]
      },
      {
        id: 2,
        maxPeople: 3,
        beds: [
          { bedType: 'double', isSeparable: true },
          { bedType: 'single' }
        ]
      }
    ];
    expect(maxBedPreferenceLimits(rooms, 2)).toEqual({
      maxDoubleBeds: 1,
      maxSingleBeds: 2
    });
    expect(maxBedPreferenceLimits(rooms, 3)).toEqual({
      maxDoubleBeds: 1,
      maxSingleBeds: 3
    });
  });

  it('clampBedPreferenceToLimits recorta si supera máximos', () => {
    expect(
      clampBedPreferenceToLimits(
        {
          bedPreferenceNone: false,
          preferredDoubleBeds: 3,
          preferredSingleBeds: 2
        },
        { maxDoubleBeds: 1, maxSingleBeds: 2 }
      )
    ).toEqual({
      bedPreferenceNone: false,
      preferredDoubleBeds: 1,
      preferredSingleBeds: 2
    });
  });

  it('bedPreferencePlazas = matrimoniales×2 + individuales', () => {
    expect(
      bedPreferencePlazas({
        bedPreferenceNone: false,
        preferredDoubleBeds: 1,
        preferredSingleBeds: 2
      })
    ).toBe(4);
    expect(
      bedPreferencePlazas({
        bedPreferenceNone: false,
        preferredDoubleBeds: 0,
        preferredSingleBeds: 2
      })
    ).toBe(2);
  });

  it('bedPreferenceOptionExceedsGuests: con 2 ind, mat ≥1 excede', () => {
    expect(
      bedPreferenceOptionExceedsGuests({
        kind: 'double',
        count: 1,
        otherCount: 2,
        guests: 2
      })
    ).toBe(true);
    expect(
      bedPreferenceOptionExceedsGuests({
        kind: 'double',
        count: 0,
        otherCount: 2,
        guests: 2
      })
    ).toBe(false);
    expect(
      bedPreferenceOptionExceedsGuests({
        kind: 'single',
        count: 1,
        otherCount: 1,
        guests: 2
      })
    ).toBe(true);
    expect(
      bedPreferenceOptionExceedsGuests({
        kind: 'single',
        count: 0,
        otherCount: 1,
        guests: 2
      })
    ).toBe(false);
  });

  it('clampBedPreferenceToLimits recorta plazas si supera huéspedes', () => {
    expect(
      clampBedPreferenceToLimits(
        {
          bedPreferenceNone: false,
          preferredDoubleBeds: 1,
          preferredSingleBeds: 2
        },
        { maxDoubleBeds: 2, maxSingleBeds: 2, guests: 2 }
      )
    ).toEqual({
      bedPreferenceNone: false,
      preferredDoubleBeds: 1,
      preferredSingleBeds: 0
    });
  });
});
