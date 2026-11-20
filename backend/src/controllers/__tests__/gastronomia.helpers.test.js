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
    expect(rows.map((r) => r.section)).toEqual(['ENSALADA', 'SOPA']);
    expect(rows.find((r) => r.section === 'SOPA').name).toBe('Crema de zapallo');
  });

  it('normalizeIncomingItems acepta SOPA y PLATO_INFANTIL', () => {
    const rows = normalizeIncomingItems('CONVENTIONAL', [
      { name: 'Sopa del día', section: 'SOPA' },
      { name: 'Nuggets', section: 'PLATO_INFANTIL' },
      { name: 'Flan', section: 'POSTRE' },
      { name: 'Helado', section: 'POSTRE' }
    ]);
    expect(rows.map((r) => r.section)).toEqual([
      'ENSALADA',
      'SOPA',
      'PLATO_INFANTIL',
      'POSTRE',
      'POSTRE'
    ]);
    expect(rows.find((r) => r.section === 'ENSALADA').name).toBe('mesa de ensaladas');
  });

  it('normalizeIncomingItems fuerza mesa de ensaladas e ignora ENSALADA editable', () => {
    const rows = normalizeIncomingItems('CONVENTIONAL', [
      { name: 'Caesar', section: 'ENSALADA' },
      { name: 'Milanesa', section: 'PRIMER_PLATO' }
    ]);
    const ensaladas = rows.filter((r) => r.section === 'ENSALADA');
    expect(ensaladas).toHaveLength(1);
    expect(ensaladas[0].name).toBe('mesa de ensaladas');
    expect(ensaladas[0].description).toBeNull();
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
