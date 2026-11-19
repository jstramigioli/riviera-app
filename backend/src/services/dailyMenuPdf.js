const PDFDocument = require('pdfkit');

const RIVIERA_BLUE = '#3f5f8a';
const TEXT_DARK = '#1f2933';
const TEXT_MUTED = '#5a6f85';

const SECTION_LABELS = {
  ENTRADA: 'Entrada',
  ENSALADA: 'Ensalada',
  PRIMER_PLATO: 'Primer plato',
  SEGUNDO_PLATO: 'Segundo plato',
  POSTRE: 'Postre',
  BUFFET: 'Buffet'
};

const CONVENTIONAL_ORDER = [
  'ENTRADA',
  'ENSALADA',
  'PRIMER_PLATO',
  'SEGUNDO_PLATO',
  'POSTRE'
];

function formatMenuDate(dateValue) {
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(d);
}

function groupItems(items) {
  const map = new Map();
  for (const item of items || []) {
    const key = item.section || 'BUFFET';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  return map;
}

/**
 * Genera un Buffer PDF A5 (148×210 mm) del menú diario.
 */
function buildDailyMenuPdfBuffer(menu) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [148 * 2.83465, 210 * 2.83465], // mm → pt
      margins: { top: 36, bottom: 36, left: 36, right: 36 },
      info: {
        Title: `Menú · Hotel Riviera`,
        Author: 'Hotel Riviera',
        Subject: 'Menú diario media pensión'
      }
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;

    // Banda superior azul
    doc.save();
    doc.rect(0, 0, pageWidth, 52).fill(RIVIERA_BLUE);
    doc.restore();

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Hotel Riviera', doc.page.margins.left, 18, {
        width: contentWidth,
        align: 'center'
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .text('Menú · media pensión', {
        width: contentWidth,
        align: 'center'
      });

    doc.moveDown(2.2);
    doc.fillColor(TEXT_DARK);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(formatMenuDate(menu.date), { align: 'center' });

    const kindLabel = menu.kind === 'BUFFET' ? 'Buffet' : 'Menú convencional';
    doc
      .moveDown(0.3)
      .font('Helvetica')
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text(kindLabel, { align: 'center' });

    doc
      .moveDown(0.6)
      .strokeColor(RIVIERA_BLUE)
      .lineWidth(1)
      .moveTo(doc.page.margins.left + 20, doc.y)
      .lineTo(pageWidth - doc.page.margins.right - 20, doc.y)
      .stroke();

    doc.moveDown(1);
    doc.fillColor(TEXT_DARK);

    const bySection = groupItems(menu.items);
    const itemCount = (menu.items || []).length;
    const nameSize = itemCount > 18 ? 9 : itemCount > 10 ? 10 : 11;
    const descSize = Math.max(8, nameSize - 2);

    if (menu.kind === 'BUFFET') {
      const list = bySection.get('BUFFET') || [];
      if (!list.length) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(TEXT_MUTED);
        doc.text('Sin preparaciones.', { align: 'center' });
      } else {
        for (const item of list) {
          doc
            .fillColor(TEXT_DARK)
            .font('Helvetica-Bold')
            .fontSize(nameSize)
            .text(item.nameSnapshot, { align: 'center' });
          if (item.descriptionSnap) {
            doc
              .font('Helvetica')
              .fontSize(descSize)
              .fillColor(TEXT_MUTED)
              .text(item.descriptionSnap, { align: 'center' });
          }
          doc.moveDown(0.45);
        }
      }
    } else {
      let printed = 0;
      for (const section of CONVENTIONAL_ORDER) {
        const list = bySection.get(section) || [];
        if (!list.length) continue;
        printed += 1;
        doc
          .fillColor(RIVIERA_BLUE)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(SECTION_LABELS[section].toUpperCase(), { align: 'center', characterSpacing: 1.2 });
        doc.moveDown(0.25);
        for (const item of list) {
          doc
            .fillColor(TEXT_DARK)
            .font('Helvetica-Bold')
            .fontSize(nameSize)
            .text(item.nameSnapshot, { align: 'center' });
          if (item.descriptionSnap) {
            doc
              .font('Helvetica')
              .fontSize(descSize)
              .fillColor(TEXT_MUTED)
              .text(item.descriptionSnap, { align: 'center' });
          }
          doc.moveDown(0.35);
        }
        doc.moveDown(0.35);
      }
      if (!printed) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(TEXT_MUTED);
        doc.text('Sin platos cargados.', { align: 'center' });
      }
    }

    doc.end();
  });
}

module.exports = {
  buildDailyMenuPdfBuffer,
  SECTION_LABELS,
  CONVENTIONAL_ORDER
};
