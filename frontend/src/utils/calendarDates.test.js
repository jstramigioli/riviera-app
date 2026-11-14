import { describe, it, expect } from 'vitest';
import {
  isoDate,
  shiftIso,
  daysBetween,
  todayIsoLocal,
  formatDateUi,
  toDateOnlyUtc
} from './calendarDates';

describe('calendarDates', () => {
  it('shifts civil days across month boundaries', () => {
    expect(shiftIso('2026-10-29', 5)).toBe('2026-11-03');
    expect(daysBetween('2026-10-01', '2026-10-11')).toBe(10);
  });

  it('formats UI as DD/MM/AAAA', () => {
    expect(formatDateUi('2026-10-28')).toBe('28/10/2026');
  });

  it('todayIsoLocal matches local yyyy-MM-dd', () => {
    const n = new Date();
    const expected = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    expect(todayIsoLocal()).toBe(expected);
  });

  it('isoDate from UTC date-only Date', () => {
    expect(isoDate(toDateOnlyUtc('2026-12-31'))).toBe('2026-12-31');
  });
});
