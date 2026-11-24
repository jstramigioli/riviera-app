const {
  buildDailyMenuPdfBuffer,
  resolveMenuSpacing,
  POSTRE_TWO_COL_MIN,
  MAIN_MIN_PT,
  NAME_PT,
  TITLE_PT,
  DATE_PT,
  SECTION_PT,
  DESC_PT,
  A5_PT
} = require('./dailyMenuPdf');

const DENSE_13_12_ITEMS = [
  {
    section: 'ENTRADA',
    nameSnapshot: 'Selección de fiambres con Terrina de verduras',
    descriptionSnap: null,
    sortOrder: 0
  },
  {
    section: 'ENSALADA',
    nameSnapshot: 'mesa de ensaladas',
    descriptionSnap: null,
    sortOrder: 1
  },
  {
    section: 'SOPA',
    nameSnapshot: 'Sopa crema Mixta - Consomé clarificado',
    descriptionSnap: null,
    sortOrder: 2
  },
  {
    section: 'PRIMER_PLATO',
    nameSnapshot: 'Lasagna rellena a la Sorrentina',
    descriptionSnap: null,
    sortOrder: 3
  },
  {
    section: 'SEGUNDO_PLATO',
    nameSnapshot: 'Carré de cerdo laqueado',
    descriptionSnap: 'Acompañado por Chutney de peras y manzanas',
    sortOrder: 4
  },
  {
    section: 'PLATO_INFANTIL',
    nameSnapshot: 'Salchichas con puré',
    descriptionSnap: null,
    sortOrder: 5
  },
  ...[
    'Flan al caramelo',
    'Ensalada de frutas',
    'Duraznos al Oporto',
    'Duraznos en almíbar',
    'Peras al Chablís',
    'Tarta Banoffe',
    'Helados',
    'Compotas',
    'Budín de pan',
    'Tiramisú',
    'Torta Moka',
    'Mousse de chocolate'
  ].map((name, i) => ({
    section: 'POSTRE',
    nameSnapshot: name,
    descriptionSnap: null,
    sortOrder: 6 + i
  }))
];

describe('dailyMenuPdf', () => {
  it('platos/secciones fijos en 16pt y página A5', () => {
    expect(NAME_PT).toBe(16);
    expect(SECTION_PT).toBe(16);
    expect(MAIN_MIN_PT).toBe(16);
    expect(TITLE_PT).toBe(18);
    expect(DATE_PT).toBe(12);
    expect(DESC_PT).toBe(14);
    expect(A5_PT[0]).toBeCloseTo(148 * 2.83465, 3);
    expect(A5_PT[1]).toBeCloseTo(210 * 2.83465, 3);
  });

  it('genera un PDF con cabecera application/pdf-like bytes', async () => {
    const buf = await buildDailyMenuPdfBuffer({
      date: new Date(Date.UTC(2026, 10, 18, 12)),
      kind: 'CONVENTIONAL',
      items: [
        {
          section: 'ENTRADA',
          nameSnapshot: 'Empanadas',
          descriptionSnap: null,
          sortOrder: 0
        },
        {
          section: 'SOPA',
          nameSnapshot: 'Crema de zapallo',
          descriptionSnap: null,
          sortOrder: 1
        },
        {
          section: 'PLATO_INFANTIL',
          nameSnapshot: 'Nuggets',
          descriptionSnap: null,
          sortOrder: 2
        },
        {
          section: 'POSTRE',
          nameSnapshot: 'Flan',
          descriptionSnap: 'Con dulce de leche',
          sortOrder: 3
        },
        {
          section: 'POSTRE',
          nameSnapshot: 'Helado',
          descriptionSnap: null,
          sortOrder: 4
        }
      ]
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(500);
    const asText = buf.toString('latin1');
    expect(asText).not.toMatch(/media pensi/i);
    expect(asText).not.toMatch(/Men.? convencional/i);
  });

  it('omite secciones vacías en convencional', async () => {
    const buf = await buildDailyMenuPdfBuffer({
      date: new Date(Date.UTC(2026, 10, 19, 12)),
      kind: 'CONVENTIONAL',
      items: []
    });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it(`genera PDF con postres en 2 columnas (≥${POSTRE_TWO_COL_MIN})`, async () => {
    const desserts = Array.from({ length: POSTRE_TWO_COL_MIN + 1 }, (_, i) => ({
      section: 'POSTRE',
      nameSnapshot: `Postre ${i + 1}`,
      descriptionSnap: null,
      sortOrder: i
    }));
    const buf = await buildDailyMenuPdfBuffer({
      date: new Date(Date.UTC(2026, 10, 20, 12)),
      kind: 'CONVENTIONAL',
      items: desserts
    });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('menú denso 13/12: 16pt, 1 A5, gaps caben sin overflow', async () => {
    const menu = {
      date: new Date(Date.UTC(2026, 11, 13, 12)),
      kind: 'CONVENTIONAL',
      items: DENSE_13_12_ITEMS
    };
    const spacing = resolveMenuSpacing(menu);
    expect(spacing.fits).toBe(true);
    expect(spacing.nameSize).toBe(16);
    expect(spacing.sectionSize).toBe(16);
    // El pie no acumula slack: último texto cerca del borde útil.
    expect(spacing.bottomGap).toBeLessThan(3);
    expect(spacing.bottomEdgeGap).toBeLessThan(12);

    const buf = await buildDailyMenuPdfBuffer(menu);
    const asText = buf.toString('latin1');
    const pageCount = Number((asText.match(/\/Count\s+(\d+)/) || [])[1] || 0);
    expect(pageCount).toBe(1);
  });

  it('menú corto reparte más aire que el denso (no acumula todo abajo)', () => {
    const dense = resolveMenuSpacing({
      date: new Date(Date.UTC(2026, 11, 13, 12)),
      kind: 'CONVENTIONAL',
      items: DENSE_13_12_ITEMS
    });
    const sparse = resolveMenuSpacing({
      date: new Date(Date.UTC(2026, 11, 14, 12)),
      kind: 'CONVENTIONAL',
      items: [
        {
          section: 'ENTRADA',
          nameSnapshot: 'Empanadas',
          descriptionSnap: null,
          sortOrder: 0
        },
        {
          section: 'SOPA',
          nameSnapshot: 'Consomé',
          descriptionSnap: null,
          sortOrder: 1
        },
        {
          section: 'PRIMER_PLATO',
          nameSnapshot: 'Ñoquis',
          descriptionSnap: null,
          sortOrder: 2
        },
        {
          section: 'POSTRE',
          nameSnapshot: 'Flan',
          descriptionSnap: null,
          sortOrder: 3
        },
        {
          section: 'POSTRE',
          nameSnapshot: 'Helado',
          descriptionSnap: null,
          sortOrder: 4
        }
      ]
    });
    expect(sparse.afterSection).toBeGreaterThan(dense.afterSection);
    expect(sparse.itemGap + sparse.afterSection).toBeGreaterThan(
      dense.itemGap + dense.afterSection
    );
    expect(sparse.slack).toBeGreaterThan(dense.slack);
    expect(sparse.bottomGap).toBeLessThan(3);
    expect(dense.bottomGap).toBeLessThan(3);
    expect(sparse.bottomEdgeGap).toBeLessThan(12);
    expect(dense.bottomEdgeGap).toBeLessThan(12);
  });
});
