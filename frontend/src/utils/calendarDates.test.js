import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isoDate,
  shiftIso,
  daysBetween,
  todayIsoLocal,
  todayAsLocalDate,
  realTodayIsoLocal,
  setSimulatedTodayIso,
  clearSimulatedToday,
  getSimulatedTodayIso,
  formatDateUi,
  toDateOnlyUtc,
  SIMULATED_TODAY_STORAGE_KEY
} from './calendarDates';

describe('calendarDates', () => {
  beforeEach(() => {
    clearSimulatedToday();
  });

  afterEach(() => {
    clearSimulatedToday();
  });

  it('shifts civil days across month boundaries', () => {
    expect(shiftIso('2026-10-29', 5)).toBe('2026-11-03');
    expect(daysBetween('2026-10-01', '2026-10-11')).toBe(10);
  });

  it('formats UI as DD/MM/AAAA', () => {
    expect(formatDateUi('2026-10-28')).toBe('28/10/2026');
  });

  it('realTodayIsoLocal matches local yyyy-MM-dd', () => {
    const n = new Date();
    const expected = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    expect(realTodayIsoLocal()).toBe(expected);
  });

  it('todayIsoLocal uses simulated date from localStorage', () => {
    setSimulatedTodayIso('2026-01-15');
    expect(getSimulatedTodayIso()).toBe('2026-01-15');
    expect(todayIsoLocal()).toBe('2026-01-15');
    expect(localStorage.getItem(SIMULATED_TODAY_STORAGE_KEY)).toBe('2026-01-15');
    clearSimulatedToday();
    expect(todayIsoLocal()).toBe(realTodayIsoLocal());
  });

  it('todayAsLocalDate maps clock onto simulated day', () => {
    setSimulatedTodayIso('2026-02-20');
    const d = todayAsLocalDate();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(20);
  });

  it('isoDate from UTC date-only Date', () => {
    expect(isoDate(toDateOnlyUtc('2026-12-31'))).toBe('2026-12-31');
  });
});
