const {
  buildDailyMenuPdfBuffer,
  resolveFitTypography,
  POSTRE_TWO_COL_MIN,
  NAME_PT,
  NAME_PT_FLOOR,
  TITLE_PT,
  DATE_PT,
  SECTION_PT,
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
  it('objetivo tipográfico ~16pt, piso de auto-fit, página A5', () => {
    expect(NAME_PT).toBe(16);
    expect(SECTION_PT).toBe(16);
    expect(NAME_PT_FLOOR).toBeLessThanOrEqual(NAME_PT);
    expect(TITLE_PT).toBe(18);
    expect(DATE_PT).toBe(12);
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

  it('menú denso 13/12 cabe en 1 A5 (auto-fit ≤16pt, sin gaps fluidos)', async () => {
    const menu = {
      date: new Date(Date.UTC(2026, 11, 13, 12)),
      kind: 'CONVENTIONAL',
      items: DENSE_13_12_ITEMS
    };
    const fit = resolveFitTypography(menu);
    expect(fit.fits).toBe(true);
    expect(fit.nameSize).toBeLessThanOrEqual(NAME_PT);
    expect(fit.nameSize).toBeGreaterThanOrEqual(NAME_PT_FLOOR);
    expect(fit.sectionSize).toBe(fit.nameSize);
    expect(fit.pageCount).toBe(1);

    const buf = await buildDailyMenuPdfBuffer(menu);
    const asText = buf.toString('latin1');
    const pageCount = Number((asText.match(/\/Count\s+(\d+)/) || [])[1] || 0);
    expect(pageCount).toBe(1);
  });
});
