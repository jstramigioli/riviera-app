const {
  toPlain,
  computeDiff,
  buildSummary,
  entityIdFromRecord
} = require('../../src/audit/serialize');

describe('audit serialize', () => {
  test('redacta passwordHash', () => {
    const plain = toPlain({ id: 1, passwordHash: 'secret', name: 'x' });
    expect(plain.passwordHash).toBe('[redacted]');
    expect(plain.name).toBe('x');
  });

  test('diff ignora updatedAt y marca cambios', () => {
    const diff = computeDiff(
      { status: 'PENDIENTE', updatedAt: 'a', notes: null },
      { status: 'CONFIRMADA', updatedAt: 'b', notes: 'hola' }
    );
    expect(diff.status).toEqual({ from: 'PENDIENTE', to: 'CONFIRMADA' });
    expect(diff.notes).toEqual({ from: null, to: 'hola' });
    expect(diff.updatedAt).toBeUndefined();
  });

  test('summary incluye entidad e id', () => {
    const summary = buildSummary('UPDATE', 'Reservation', null, { id: 12, status: 'INGRESADA' }, '12');
    expect(summary).toContain('UPDATE Reservation#12');
    expect(summary).toContain('status=INGRESADA');
  });

  test('entityIdFromRecord', () => {
    expect(entityIdFromRecord({ id: 5 })).toBe('5');
    expect(entityIdFromRecord({ id: 'abc' })).toBe('abc');
    expect(entityIdFromRecord(null)).toBeNull();
  });
});
