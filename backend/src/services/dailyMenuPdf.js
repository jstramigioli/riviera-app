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

/**
 * Objetivo ~16pt. Si no entra en 1 A5, auto-reduce hasta NAME_PT_FLOOR.
 * Gaps fijos. PDFKit no puede partir página a mitad de columnas.
 */
const NAME_PT = 16;
const NAME_PT_FLOOR = 9;
const SECTION_PT = 16;
const TITLE_PT = 18;
const DATE_PT = 12;
const DESC_PT = 14;
const MAIN_MIN_PT = NAME_PT_FLOOR;

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

const PAGE_MARGINS = { top: 16, bottom: 14, left: 24, right: 24 };

/** Gaps fijos — no se expanden. */
const BAND_PAD = 8;
const BAND_TO_TITLE = 6;
const AFTER_TITLE = 3;
const AFTER_DATE = 4;
const AFTER_RULE = 7;
const AFTER_SECTION_TITLE = 2;
const ITEM_GAP = 2;
const AFTER_SECTION = 5;
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

function typographyForNameSize(namePt) {
  return {
    nameSize: namePt,
    sectionSize: namePt,
    titleSize: Math.max(12, namePt + 2),
    dateSize: Math.max(9, Math.round(namePt * 0.72)),
    descSize: Math.max(8, namePt - 2),
    logoH: namePt >= 14 ? 36 : namePt >= 12 ? 32 : 28
  };
}

/**
 * Impide que PDFKit inserte páginas (causa clásica de 2ª col. de postres rota).
 * El overflow se detecta con finalY > bottomLimit y se baja la tipografía.
 */
function lockSinglePage(doc) {
  const original = doc.addPage;
  doc.addPage = function addPageLocked() {
    return this;
  };
  return () => {
    doc.addPage = original;
  };
}

function countPdfPages(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('latin1') : String(buffer);
  const count = Number((text.match(/\/Count\s+(\d+)/) || [])[1] || 0);
  if (count > 0) return count;
  return (text.match(/\/Type\s*\/Page[^s]/g) || []).length || 1;
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
 * Postres en 1–2 columnas, siempre en la misma página (addPage bloqueado).
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

  doc.x = left;
  doc.y = Math.max(leftY, rightY);
}

function paintDailyMenu(doc, menu, typo, logoPath) {
  const unlock = lockSinglePage(doc);
  try {
    const pageWidth = doc.page.width;
    const left = doc.page.margins.left;
    const contentWidth = pageWidth - left - doc.page.margins.right;
    const bottomLimit = A5_PT[1] - PAGE_MARGINS.bottom;

    const { nameSize, sectionSize, titleSize, dateSize, descSize, logoH } = typo;
    const bySection = groupItems(menu.items);
    const logoW = logoPath ? logoH * LOGO_ASPECT : 0;
    const bandHeight = logoPath ? logoH + BAND_PAD : 40;

    doc.page.margins.bottom = 0;

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
        .fontSize(Math.min(14, titleSize))
        .text('Hotel Riviera', left, 12, {
          width: contentWidth,
          align: 'center'
        });
    }

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
              characterSpacing: 0.5
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
            characterSpacing: 0.5
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

    return {
      finalY: doc.y,
      bottomLimit,
      fits: doc.y <= bottomLimit + 0.5
    };
  } finally {
    unlock();
  }
}

function createDoc() {
  return new PDFDocument({
    size: A5_PT,
    margins: { ...PAGE_MARGINS },
    autoFirstPage: true,
    bufferPages: true,
    info: {
      Title: `Menú · Hotel Riviera`,
      Author: 'Hotel Riviera',
      Subject: 'Menú diario'
    }
  });
}

function renderMenuToBuffer(menu, typo, logoPath) {
  return new Promise((resolve, reject) => {
    const doc = createDoc();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    paintDailyMenu(doc, menu, typo, logoPath);
    doc.end();
  });
}

/**
 * Mayor tipografía ≤16pt que cabe en 1 A5 (gaps fijos, sin page-break).
 */
async function resolveFitTypography(menu, logoPath = resolveLogoPath()) {
  let chosen = {
    ...typographyForNameSize(NAME_PT_FLOOR),
    fits: false,
    namePt: NAME_PT_FLOOR
  };

  for (let namePt = NAME_PT; namePt >= NAME_PT_FLOOR; namePt -= 1) {
    const typo = typographyForNameSize(namePt);
    const doc = createDoc();
    doc.on('data', () => {});
    const painted = paintDailyMenu(doc, menu, typo, logoPath);
    try {
      doc.end();
    } catch (_) {
      /* ignore */
    }
    if (painted.fits) {
      // Verificación dura: buffer real debe ser 1 página.
      const buf = await renderMenuToBuffer(menu, typo, logoPath);
      const pages = countPdfPages(buf);
      if (pages === 1) {
        return {
          ...typo,
          fits: true,
          namePt,
          finalY: painted.finalY,
          bottomLimit: painted.bottomLimit,
          pageCount: 1
        };
      }
    }
  }
  return chosen;
}

/**
 * Genera PDF A5. Garantiza 1 página: bloquea addPage + autofit + recount.
 */
async function buildDailyMenuPdfBuffer(menu) {
  const logoPath = resolveLogoPath();
  const fit = await resolveFitTypography(menu, logoPath);
  let typo = fit.fits ? fit : typographyForNameSize(NAME_PT_FLOOR);

  let buffer = await renderMenuToBuffer(menu, typo, logoPath);
  let pages = countPdfPages(buffer);

  // Red de seguridad: si aún hay >1 página, bajar pt hasta 1 hoja.
  let namePt = typo.nameSize;
  while (pages > 1 && namePt > NAME_PT_FLOOR) {
    namePt -= 1;
    typo = typographyForNameSize(namePt);
    buffer = await renderMenuToBuffer(menu, typo, logoPath);
    pages = countPdfPages(buffer);
  }

  return buffer;
}

module.exports = {
  buildDailyMenuPdfBuffer,
  resolveFitTypography,
  typographyForNameSize,
  countPdfPages,
  SECTION_LABELS,
  CONVENTIONAL_ORDER,
  MESA_ENSALADAS,
  POSTRE_TWO_COL_MIN,
  MAIN_MIN_PT,
  NAME_PT,
  NAME_PT_FLOOR,
  TITLE_PT,
  DATE_PT,
  SECTION_PT,
  DESC_PT,
  A5_PT,
  A4_PT
};
