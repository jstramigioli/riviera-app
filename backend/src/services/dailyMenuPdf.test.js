const { buildDailyMenuPdfBuffer, POSTRE_TWO_COL_MIN } = require('./dailyMenuPdf');

describe('dailyMenuPdf', () => {
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
    // Metadatos / literales ASCII: no deben reaparecer los textos retirados.
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
});
