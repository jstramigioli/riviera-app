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

/** Elementos principales del menú imprimible: ningún < 14 pt (fecha cabe más chica). */
const MAIN_MIN_PT = 14;
const TITLE_PT = 16;
/** Fecha bajo título: más chica para caber en 1 página. */
const DATE_PT = 11;
const SECTION_PT = MAIN_MIN_PT;

/** A4 en puntos (210×297 mm). */
const A4_PT = [210 * 2.83465, 297 * 2.83465];

/** Logo oficial Riviera Hotel (blanco sobre negro, ~16:9 / 740×410). */
const LOGO_ASPECT = 740 / 410;

const LOGO_CANDIDATES = [
  path.join(__dirname, '../../assets/riviera-hotel-logo.png'),
  path.join(__dirname, '../../../frontend/public/riviera-hotel-logo.png'),
  path.join(__dirname, '../../../frontend/src/assets/riviera-hotel-logo.png'),
  path.join(__dirname, '../../assets/logo-hotel.png'),
  path.join(__dirname, '../../../frontend/src/assets/logo-hotel.png')
];

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

/**
 * Dibuja un ítem centrado en (x, y) y devuelve la Y siguiente.
 * Usa posición absoluta para no depender del flujo que parte páginas a mitad de columna.
 */
function drawCenteredItemAt(doc, item, nameSize, descSize, x, width, y) {
  doc
    .fillColor(TEXT_DARK)
    .font('Helvetica-Bold')
    .fontSize(nameSize)
    .text(item.nameSnapshot, x, y, {
      width,
      align: 'center',
      lineGap: 1
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
        lineGap: 1
      });
    nextY = doc.y;
  }
  return nextY;
}

function drawCenteredItem(doc, item, nameSize, descSize, x, width) {
  const nextY = drawCenteredItemAt(doc, item, nameSize, descSize, x, width, doc.y);
  doc.y = nextY;
}

/**
 * Postres en una o dos columnas. Con muchos (≥ POSTRE_TWO_COL_MIN) usa 2 cols.
 *
 * Importante: PDFKit parte página al superar el margen inferior mientras se
 * dibuja la columna izquierda; al resetear `doc.y` para la derecha, esa
 * columna queda en otra hoja / mal alineada. Por eso medimos y dibujamos con
 * Y absoluta y desactivamos el salto automático durante el bloque de columnas.
 */
function drawPostreItems(doc, list, nameSize, descSize, left, contentWidth, itemGap = 0.28) {
  const gapAfter = nameSize * itemGap;

  if (list.length < POSTRE_TWO_COL_MIN) {
    for (const item of list) {
      drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
      doc.y += gapAfter;
    }
    return;
  }

  const gap = 14;
  const colWidth = (contentWidth - gap) / 2;
  const mid = Math.ceil(list.length / 2);
  const leftCol = list.slice(0, mid);
  const rightCol = list.slice(mid);
  const startY = doc.y;
  const rightX = left + colWidth + gap;

  // Evita saltos de página a mitad de columna (causa clásica de 2ª col. rota).
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  let leftY = startY;
  for (const item of leftCol) {
    leftY = drawCenteredItemAt(doc, item, nameSize, descSize, left, colWidth, leftY);
    leftY += gapAfter;
  }

  let rightY = startY;
  for (const item of rightCol) {
    rightY = drawCenteredItemAt(doc, item, nameSize, descSize, rightX, colWidth, rightY);
    rightY += gapAfter;
  }

  doc.page.margins.bottom = savedBottom;
  doc.x = left;
  doc.y = Math.max(leftY, rightY);
}

/**
 * Genera un Buffer PDF A4 (210×297 mm) del menú diario.
 * Título: «Menú» + fecha. Sin textos «Menú convencional» / «media pensión».
 */
function buildDailyMenuPdfBuffer(menu) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: A4_PT,
      margins: { top: 40, bottom: 40, left: 48, right: 48 },
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
    const itemCount = (menu.items || []).length;
    const postreCount = (bySection.get('POSTRE') || []).length;
    // Densidad: menús con muchos postres aprietan un poco el ritmo vertical.
    const dense = itemCount > 14 || postreCount >= 8;
    const nameSize = MAIN_MIN_PT;
    const descSize = Math.max(9, nameSize - 3);
    // En A4 hay más aire: densos aprietan poco; el resto respira más.
    const sectionGap = dense ? 0.48 : 0.62;
    const itemGap = dense ? 0.28 : 0.38;
    const afterSectionGap = dense ? 0.28 : 0.42;

    // Banda azul Riviera + logo sin deformar (~16:9).
    const logoH = logoPath ? (dense ? 48 : 54) : 0;
    const logoW = logoPath ? logoH * LOGO_ASPECT : 0;
    const bandHeight = logoPath ? logoH + 16 : 52;
    doc.save();
    doc.rect(0, 0, pageWidth, bandHeight).fill(RIVIERA_BLUE);
    doc.restore();

    if (logoPath) {
      doc.image(logoPath, (pageWidth - logoW) / 2, (bandHeight - logoH) / 2, {
        height: logoH
      });
    } else {
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('Hotel Riviera', left, 18, {
          width: contentWidth,
          align: 'center'
        });
    }

    doc.y = bandHeight + (dense ? 16 : 20);
    doc
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .fontSize(TITLE_PT)
      .text('Menú', left, doc.y, { width: contentWidth, align: 'center' });
    doc
      .moveDown(0.22)
      .font('Helvetica')
      .fontSize(DATE_PT)
      .fillColor(TEXT_DARK)
      .text(formatMenuDate(menu.date), { align: 'center' });

    doc
      .moveDown(0.5)
      .strokeColor(RIVIERA_BLUE)
      .lineWidth(1)
      .moveTo(left + 28, doc.y)
      .lineTo(pageWidth - doc.page.margins.right - 28, doc.y)
      .stroke();

    doc.moveDown(dense ? 0.85 : 1.05);
    doc.fillColor(TEXT_DARK);

    if (menu.kind === 'BUFFET') {
      const list = bySection.get('BUFFET') || [];
      if (!list.length) {
        doc.font('Helvetica-Oblique').fontSize(10).fillColor(TEXT_MUTED);
        doc.text('Sin preparaciones.', { align: 'center' });
      } else {
        for (const item of list) {
          drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
          doc.y += nameSize * itemGap;
        }
      }
    } else {
      let printed = 0;
      for (const section of CONVENTIONAL_ORDER) {
        // Solo título tipográfico «mesa de ensaladas» (misma tipo que Entrada/Plato);
        // sin sección + contenido, sin itálica.
        if (section === 'ENSALADA') {
          printed += 1;
          doc
            .fillColor(RIVIERA_BLUE)
            .font('Helvetica-Bold')
            .fontSize(SECTION_PT)
            .text(MESA_ENSALADAS.toUpperCase(), left, doc.y, {
              width: contentWidth,
              align: 'center',
              characterSpacing: 1.2
            });
          doc.moveDown(sectionGap);
          continue;
        }
        const list = bySection.get(section) || [];
        if (!list.length) continue;
        printed += 1;
        doc
          .fillColor(RIVIERA_BLUE)
          .font('Helvetica-Bold')
          .fontSize(SECTION_PT)
          .text(SECTION_LABELS[section].toUpperCase(), left, doc.y, {
            width: contentWidth,
            align: 'center',
            characterSpacing: 1.2
          });
        doc.moveDown(0.2);
        if (section === 'POSTRE') {
          drawPostreItems(doc, list, nameSize, descSize, left, contentWidth, itemGap);
        } else {
          for (const item of list) {
            drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
            doc.y += nameSize * itemGap;
          }
        }
        doc.moveDown(afterSectionGap);
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
  CONVENTIONAL_ORDER,
  MESA_ENSALADAS,
  POSTRE_TWO_COL_MIN,
  MAIN_MIN_PT,
  TITLE_PT,
  DATE_PT,
  SECTION_PT,
  A4_PT
};
