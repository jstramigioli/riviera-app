const {
  normalizeStatus,
  parseInclusiveRange,
  parseExclusiveRange,
  statusLabel,
  ROOM_STATUS
} = require('../../src/utils/roomStatusPeriods');

describe('roomStatusPeriods utils', () => {
  it('normaliza labels y aliases', () => {
    expect(normalizeStatus('Disponible')).toBe(ROOM_STATUS.AVAILABLE);
    expect(normalizeStatus('mantenimiento')).toBe(ROOM_STATUS.MAINTENANCE);
    expect(normalizeStatus('no_disponible')).toBe(ROOM_STATUS.UNAVAILABLE);
    expect(normalizeStatus('unavailable')).toBe(ROOM_STATUS.UNAVAILABLE);
    expect(normalizeStatus('foo')).toBeNull();
  });

  it('parsea rango inclusive → exclusive', () => {
    const range = parseInclusiveRange('2026-03-10', '2026-03-15');
    expect(range.error).toBeUndefined();
    expect(range.startIso).toBe('2026-03-10');
    expect(range.endIso).toBe('2026-03-16');
    expect(range.endInclusiveIso).toBe('2026-03-15');
  });

  it('rechaza rangos inválidos', () => {
    expect(parseInclusiveRange('2026-03-15', '2026-03-10').error).toBeTruthy();
    expect(parseExclusiveRange('2026-03-10', '2026-03-10').error).toBeTruthy();
  });

  it('labels en español', () => {
    expect(statusLabel('maintenance')).toBe('Mantenimiento');
    expect(statusLabel('unavailable')).toBe('No disponible');
    expect(statusLabel('available')).toBe('Disponible');
  });
});
