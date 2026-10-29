const {
  toDateOnlyUtc,
  isoDate,
  shiftIso,
  civilFromDb,
  daysBetweenCivil
} = require('../src/utils/calendarDates');

describe('calendarDates (civil day)', () => {
  test('isoDate and shiftIso stay on civil calendar', () => {
    expect(isoDate('2026-10-29')).toBe('2026-10-29');
    expect(shiftIso('2026-10-29', 3)).toBe('2026-11-01');
    expect(shiftIso('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('daysBetweenCivil is half-open night count friendly', () => {
    expect(daysBetweenCivil('2026-01-01', '2026-01-04')).toBe(3);
    expect(daysBetweenCivil('2026-01-05', '2026-01-05')).toBe(0);
  });

  test('civilFromDb strips time / Z without shifting the calendar day (UTC midnight)', () => {
    expect(civilFromDb('2026-07-23T00:00:00.000Z')).toBe('2026-07-23');
    expect(civilFromDb(new Date('2026-07-23T00:00:00.000Z'))).toBe('2026-07-23');
  });

  test('toDateOnlyUtc normalizes strings of length 10', () => {
    const d = toDateOnlyUtc('2027-01-09');
    expect(isoDate(d)).toBe('2027-01-09');
  });
});
