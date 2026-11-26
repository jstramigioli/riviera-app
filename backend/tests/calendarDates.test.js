const {
  toDateOnlyUtc,
  isoDate,
  shiftIso,
  civilFromDb,
  daysBetweenCivil,
  SIMULATED_TODAY_HEADER,
  realTodayIsoLocal,
  todayIsoLocal,
  nowLocal,
  parseFechaInput
} = require('../src/utils/calendarDates');

const ADMIN = { role: 'ADMIN' };

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

  test('todayIsoLocal respeta X-Simulated-Today', () => {
    const req = { user: ADMIN, headers: { [SIMULATED_TODAY_HEADER]: '2026-03-15' } };
    expect(todayIsoLocal(req)).toBe('2026-03-15');
    expect(todayIsoLocal({})).toBe(realTodayIsoLocal());
  });

  test('X-Simulated-Today se ignora si el usuario no es ADMIN (o no hay sesión)', () => {
    const headers = { [SIMULATED_TODAY_HEADER]: '2026-03-15' };
    expect(todayIsoLocal({ headers, user: { role: 'RECEPCION' } })).toBe(realTodayIsoLocal());
    expect(todayIsoLocal({ headers })).toBe(realTodayIsoLocal());
    const n = nowLocal({ headers, user: { role: 'GERENCIA' } });
    expect(Math.abs(n.getTime() - Date.now())).toBeLessThan(5000);
  });

  test('nowLocal mapea reloj real sobre día simulado', () => {
    const req = { user: ADMIN, headers: { [SIMULATED_TODAY_HEADER]: '2026-03-15' } };
    const n = nowLocal(req);
    expect(n.getFullYear()).toBe(2026);
    expect(n.getMonth()).toBe(2);
    expect(n.getDate()).toBe(15);
  });

  test('parseFechaInput usa día simulado si no hay fecha', () => {
    const req = { user: ADMIN, headers: { [SIMULATED_TODAY_HEADER]: '2026-04-01' } };
    const d = parseFechaInput(null, req);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(1);
  });

  test('parseFechaInput YYYY-MM-DD → mediodía local', () => {
    const d = parseFechaInput('2026-07-04', {});
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(12);
  });
});
