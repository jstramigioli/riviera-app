const { buildDailyMenuPdfBuffer } = require('./dailyMenuPdf');

describe('dailyMenuPdf', () => {
  it('genera un PDF con cabecera application/pdf-like bytes', async () => {
    const buf = await buildDailyMenuPdfBuffer({
      date: new Date(Date.UTC(2026, 10, 18, 12)),
      kind: 'CONVENTIONAL',
      items: [
        {
          section: 'ENTRADA',
          nameSnapshot: 'Sopa de zapallo',
          descriptionSnap: null,
          sortOrder: 0
        },
        {
          section: 'POSTRE',
          nameSnapshot: 'Flan',
          descriptionSnap: 'Con dulce de leche',
          sortOrder: 1
        }
      ]
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('omite secciones vacías en convencional', async () => {
    const buf = await buildDailyMenuPdfBuffer({
      date: new Date(Date.UTC(2026, 10, 19, 12)),
      kind: 'CONVENTIONAL',
      items: []
    });
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });
});
