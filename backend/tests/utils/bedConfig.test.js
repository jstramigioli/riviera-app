const {
  defaultBedsForCapacity,
  validateBedsAgainstCapacity,
  roomCanSatisfyBedPreference,
  totalBedCapacity
} = require('../../src/utils/bedConfig');

describe('bedConfig', () => {
  test('defaults triple', () => {
    const beds = defaultBedsForCapacity(3);
    expect(totalBedCapacity(beds)).toBe(3);
  });

  test('triple no admite 4 singles ni 2 doubles', () => {
    expect(validateBedsAgainstCapacity(
      [{ bedType: 'single' }, { bedType: 'single' }, { bedType: 'single' }, { bedType: 'single' }],
      3
    ).ok).toBe(false);
    expect(validateBedsAgainstCapacity(
      [{ bedType: 'double' }, { bedType: 'double' }],
      3
    ).ok).toBe(false);
  });

  test('separable cubre individuales', () => {
    expect(roomCanSatisfyBedPreference(
      [{ bedType: 'double', isSeparable: true }],
      { bedPreferenceNone: false, preferredDoubleBeds: 0, preferredSingleBeds: 2 }
    ).complies).toBe(true);
    expect(roomCanSatisfyBedPreference(
      [{ bedType: 'double', isSeparable: false }],
      { bedPreferenceNone: false, preferredDoubleBeds: 0, preferredSingleBeds: 2 }
    ).complies).toBe(false);
  });
});
