const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const RIVIERA_BLUE = '#3f5f8a';
const TEXT_DARK = '#1f2933';
const TEXT_MUTED = '#5a6f85';

const MESA_ENSALADAS = 'mesa de ensaladas';

const SECTION_LABELS = {
  ENTRADA: 'Entrada',
  ENSALADA: 'Ensaladas',
  SOPA: 'Sopa',
  PRIMER_PLATO: 'Primer plato',
  SEGUNDO_PLATO: 'Segundo plato',
  PLATO_INFANTIL: 'Plato infantil',
  POSTRE: 'Postres',
  BUFFET: 'Buffet'
};

const CONVENTIONAL_ORDER = [
  'ENTRADA',
  'ENSALADA',
  'SOPA',
  'PRIMER_PLATO',
  'SEGUNDO_PLATO',
  'PLATO_INFANTIL',
  'POSTRE'
];

/** Umbral: con 3+ postres se imprime en 2 columnas. */
const POSTRE_TWO_COL_MIN = 3;

/** Tipografía fija ~16pt platos/secciones. Gaps fijos (sin expandir). */
const NAME_PT = 16;
const SECTION_PT = 16;
const TITLE_PT = 18;
const DATE_PT = 12;
const DESC_PT = 14;
const MAIN_MIN_PT = NAME_PT;

/** A5 en puntos (148×210 mm). */
const A5_PT = [148 * 2.83465, 210 * 2.83465];
/** @deprecated alias — el menú imprimible es A5. */
const A4_PT = A5_PT;

const LOGO_ASPECT = 740 / 410;

const LOGO_CANDIDATES = [
  path.join(__dirname, '../../assets/riviera-hotel-logo.png'),
  path.join(__dirname, '../../../frontend/public/riviera-hotel-logo.png'),
  path.join(__dirname, '../../../frontend/src/assets/riviera-hotel-logo.png'),
  path.join(__dirname, '../../assets/logo-hotel.png'),
  path.join(__dirname, '../../../frontend/src/assets/logo-hotel.png')
];

const PAGE_MARGINS = { top: 22, bottom: 22, left: 28, right: 28 };

/** Espaciado fijo / mínimo — sin resolveMenuSpacing ni slack. */
const LOGO_H = 40;
const BAND_PAD = 10;
const BAND_TO_TITLE = 8;
const AFTER_TITLE = 4;
const AFTER_DATE = 6;
const AFTER_RULE = 10;
const AFTER_SECTION_TITLE = 3;
const ITEM_GAP = 4;
const AFTER_SECTION = 8;
const COL_GAP = 10;

function resolveLogoPath() {
  for (const candidate of LOGO_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

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

function drawCenteredItemAt(doc, item, nameSize, descSize, x, width, y) {
  doc
    .fillColor(TEXT_DARK)
    .font('Helvetica-Bold')
    .fontSize(nameSize)
    .text(item.nameSnapshot || '', x, y, {
      width,
      align: 'center',
      lineGap: 0
    });
  let nextY = doc.y;
  if (item.descriptionSnap) {
    doc
      .font('Helvetica')
      .fontSize(descSize)
      .fillColor(TEXT_MUTED)
      .text(item.descriptionSnap, x, nextY, {
        width,
        align: 'center',
        lineGap: 0
      });
    nextY = doc.y;
  }
  return nextY;
}

function drawCenteredItem(doc, item, nameSize, descSize, x, width) {
  doc.y = drawCenteredItemAt(doc, item, nameSize, descSize, x, width, doc.y);
}

/**
 * Postres 1–2 cols. Y absoluta + sin salto mid-columna (PDFKit).
 */
function drawPostreItems(doc, list, nameSize, descSize, left, contentWidth) {
  if (list.length < POSTRE_TWO_COL_MIN) {
    for (const item of list) {
      drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
      doc.y += ITEM_GAP;
    }
    return;
  }

  const colWidth = (contentWidth - COL_GAP) / 2;
  const mid = Math.ceil(list.length / 2);
  const leftCol = list.slice(0, mid);
  const rightCol = list.slice(mid);
  const startY = doc.y;
  const rightX = left + colWidth + COL_GAP;

  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  let leftY = startY;
  for (const item of leftCol) {
    leftY = drawCenteredItemAt(doc, item, nameSize, descSize, left, colWidth, leftY);
    leftY += ITEM_GAP;
  }

  let rightY = startY;
  for (const item of rightCol) {
    rightY = drawCenteredItemAt(
      doc,
      item,
      nameSize,
      descSize,
      rightX,
      colWidth,
      rightY
    );
    rightY += ITEM_GAP;
  }

  doc.page.margins.bottom = savedBottom;
  doc.x = left;
  doc.y = Math.max(leftY, rightY);
}

/**
 * Genera un Buffer PDF A5 (148×210 mm) del menú diario.
 * Tipografía ~16pt; espaciado fijo; postres en 2 columnas si hay ≥3.
 */
function buildDailyMenuPdfBuffer(menu) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: A5_PT,
      margins: { ...PAGE_MARGINS },
      info: {
        Title: `Menú · Hotel Riviera`,
        Author: 'Hotel Riviera',
        Subject: 'Menú diario'
      }
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const left = doc.page.margins.left;
    const contentWidth = pageWidth - left - doc.page.margins.right;
    const logoPath = resolveLogoPath();
    const bySection = groupItems(menu.items);

    const nameSize = NAME_PT;
    const sectionSize = SECTION_PT;
    const titleSize = TITLE_PT;
    const dateSize = DATE_PT;
    const descSize = DESC_PT;

    const logoW = logoPath ? LOGO_H * LOGO_ASPECT : 0;
    const bandHeight = logoPath ? LOGO_H + BAND_PAD : 44;

    doc.save();
    doc.rect(0, 0, pageWidth, bandHeight).fill(RIVIERA_BLUE);
    doc.restore();

    if (logoPath) {
      doc.image(logoPath, (pageWidth - logoW) / 2, (bandHeight - LOGO_H) / 2, {
        height: LOGO_H
      });
    } else {
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('Hotel Riviera', left, 14, {
          width: contentWidth,
          align: 'center'
        });
    }

    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.y = bandHeight + BAND_TO_TITLE;
    doc
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .fontSize(titleSize)
      .text('Menú', left, doc.y, { width: contentWidth, align: 'center' });
    doc.y += AFTER_TITLE;
    doc
      .font('Helvetica')
      .fontSize(dateSize)
      .fillColor(TEXT_DARK)
      .text(formatMenuDate(menu.date), left, doc.y, {
        width: contentWidth,
        align: 'center'
      });

    doc.y += AFTER_DATE;
    doc
      .strokeColor(RIVIERA_BLUE)
      .lineWidth(1)
      .moveTo(left + 16, doc.y)
      .lineTo(pageWidth - doc.page.margins.right - 16, doc.y)
      .stroke();
    doc.y += 1 + AFTER_RULE;
    doc.fillColor(TEXT_DARK);

    if (menu.kind === 'BUFFET') {
      const list = bySection.get('BUFFET') || [];
      if (!list.length) {
        doc.font('Helvetica-Oblique').fontSize(descSize).fillColor(TEXT_MUTED);
        doc.text('Sin preparaciones.', { align: 'center' });
      } else {
        for (const item of list) {
          drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
          doc.y += ITEM_GAP;
        }
      }
    } else {
      let printed = 0;
      for (const section of CONVENTIONAL_ORDER) {
        if (section === 'ENSALADA') {
          printed += 1;
          doc
            .fillColor(RIVIERA_BLUE)
            .font('Helvetica-Bold')
            .fontSize(sectionSize)
            .text(MESA_ENSALADAS.toUpperCase(), left, doc.y, {
              width: contentWidth,
              align: 'center',
              characterSpacing: 0.8
            });
          doc.y += AFTER_SECTION;
          continue;
        }
        const list = bySection.get(section) || [];
        if (!list.length) continue;
        printed += 1;
        doc
          .fillColor(RIVIERA_BLUE)
          .font('Helvetica-Bold')
          .fontSize(sectionSize)
          .text(SECTION_LABELS[section].toUpperCase(), left, doc.y, {
            width: contentWidth,
            align: 'center',
            characterSpacing: 0.8
          });
        doc.y += AFTER_SECTION_TITLE;
        if (section === 'POSTRE') {
          drawPostreItems(doc, list, nameSize, descSize, left, contentWidth);
        } else {
          for (const item of list) {
            drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
            doc.y += ITEM_GAP;
          }
        }
        doc.y += AFTER_SECTION;
      }
      if (!printed) {
        doc.font('Helvetica-Oblique').fontSize(descSize).fillColor(TEXT_MUTED);
        doc.text('Sin platos cargados.', { align: 'center' });
      }
    }

    doc.page.margins.bottom = savedBottom;
    doc.end();
  });
}

module.exports = {
  buildDailyMenuPdfBuffer,
  SECTION_LABELS,
  CONVENTIONAL_ORDER,
  MESA_ENSALADAS,
  POSTRE_TWO_COL_MIN,
  MAIN_MIN_PT,
  NAME_PT,
  TITLE_PT,
  DATE_PT,
  SECTION_PT,
  DESC_PT,
  A5_PT,
  A4_PT
};
