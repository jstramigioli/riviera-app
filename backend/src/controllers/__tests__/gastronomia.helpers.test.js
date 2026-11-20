const {
  _internal
} = require('../gastronomia.controller');

const {
  parseCivilDate,
  toCivilIso,
  normalizeIncomingItems,
  previewFromItems
} = _internal;

describe('gastronomia helpers', () => {
  it('parseCivilDate / toCivilIso roundtrip', () => {
    const d = parseCivilDate('2026-11-18');
    expect(d).toBeInstanceOf(Date);
    expect(toCivilIso(d)).toBe('2026-11-18');
    expect(parseCivilDate('bad')).toBeNull();
  });

  it('normalizeIncomingItems omite vacíos y fuerza BUFFET', () => {
    const rows = normalizeIncomingItems('BUFFET', [
      { name: 'Ensalada', section: 'ENTRADA' },
      { name: '  ', section: 'POSTRE' },
      { name: 'Tarta', description: 'Manzana' }
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.section === 'BUFFET')).toBe(true);
    expect(rows[1].description).toBe('Manzana');
  });

  it('normalizeIncomingItems convencional ignora sección BUFFET', () => {
    const rows = normalizeIncomingItems('CONVENTIONAL', [
      { name: 'Crema de zapallo', section: 'SOPA' },
      { name: 'Libre', section: 'BUFFET' }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].section).toBe('SOPA');
  });

  it('normalizeIncomingItems acepta SOPA', () => {
    const rows = normalizeIncomingItems('CONVENTIONAL', [
      { name: 'Sopa del día', section: 'SOPA' },
      { name: 'Flan', section: 'POSTRE' },
      { name: 'Helado', section: 'POSTRE' }
    ]);
    expect(rows.map((r) => r.section)).toEqual(['SOPA', 'POSTRE', 'POSTRE']);
  });

  it('previewFromItems resume contenido', () => {
    expect(
      previewFromItems(
        [
          { section: 'SOPA', nameSnapshot: 'Crema de zapallo', sortOrder: 0 },
          { section: 'POSTRE', nameSnapshot: 'Flan', sortOrder: 1 }
        ],
        'CONVENTIONAL'
      )
    ).toBe('Crema de zapallo · Flan');
  });
});
