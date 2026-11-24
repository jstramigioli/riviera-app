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
 * Pisos de legibilidad. El layout sube lo más posible por encima
 * mientras quepa en 1 A5 (prioriza tipo sobre aire).
 */
const MAIN_MIN_PT = 14;
const TITLE_MIN_PT = 16;
const DATE_MIN_PT = 11;
const SECTION_MIN_PT = 14;
const DESC_MIN_PT = 11;

/** Compat / tests: referencias de piso. */
const TITLE_PT = TITLE_MIN_PT;
const DATE_PT = DATE_MIN_PT;
const SECTION_PT = SECTION_MIN_PT;

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

const PAGE_MARGINS = { top: 18, bottom: 18, left: 26, right: 26 };

const NAME_PT_MAX = 22;
const NAME_PT_MIN = MAIN_MIN_PT;

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

/** Escala tipográfica: legibilidad primero, gaps mínimos. */
function typographyForNameSize(namePt) {
  const nameSize = namePt;
  const sectionSize = Math.max(SECTION_MIN_PT, namePt);
  const titleSize = Math.max(TITLE_MIN_PT, namePt + 2);
  const dateSize = Math.max(DATE_MIN_PT, Math.round(namePt * 0.7));
  const descSize = Math.max(DESC_MIN_PT, namePt - 2);
  return {
    nameSize,
    sectionSize,
    titleSize,
    dateSize,
    descSize,
    itemGap: 0.05,
    sectionGap: 0.12,
    afterSectionGap: 0.06,
    afterTitleGap: 0.08,
    afterDateGap: 0.16,
    afterRuleGap: 0.24,
    logoH: namePt >= 18 ? 32 : namePt >= 16 ? 36 : 40,
    bandPad: 8
  };
}

function itemBlockHeight(doc, item, nameSize, descSize, width) {
  doc.font('Helvetica-Bold').fontSize(nameSize);
  let h = doc.heightOfString(item.nameSnapshot || ' ', { width, lineGap: 0 });
  if (item.descriptionSnap) {
    doc.font('Helvetica').fontSize(descSize);
    h += doc.heightOfString(item.descriptionSnap, { width, lineGap: 0 });
  }
  return h;
}

function sectionTitleHeight(doc, text, sectionSize, width) {
  doc.font('Helvetica-Bold').fontSize(sectionSize);
  return doc.heightOfString(text, { width, lineGap: 0, characterSpacing: 0.6 });
}

/**
 * Simula la altura del menú sin dibujar (evita falsos "fits" por page-break de PDFKit).
 */
function measureMenuFinalY(menu, typo, logoPath) {
  const doc = new PDFDocument({
    size: A5_PT,
    margins: { ...PAGE_MARGINS },
    autoFirstPage: true
  });
  doc.on('data', () => {});

  const pageWidth = A5_PT[0];
  const left = PAGE_MARGINS.left;
  const contentWidth = pageWidth - PAGE_MARGINS.left - PAGE_MARGINS.right;
  const bottomLimit = A5_PT[1] - PAGE_MARGINS.bottom;

  const {
    nameSize,
    sectionSize,
    titleSize,
    dateSize,
    descSize,
    itemGap,
    sectionGap,
    afterSectionGap,
    afterTitleGap,
    afterDateGap,
    afterRuleGap,
    logoH,
    bandPad
  } = typo;

  const bySection = groupItems(menu.items);
  const bandHeight = logoPath ? logoH + bandPad : 40;
  let y = bandHeight + 8;

  doc.font('Helvetica-Bold').fontSize(titleSize);
  y += doc.heightOfString('Menú', { width: contentWidth, lineGap: 0 });
  y += titleSize * afterTitleGap;

  doc.font('Helvetica').fontSize(dateSize);
  y += doc.heightOfString(formatMenuDate(menu.date) || ' ', {
    width: contentWidth,
    lineGap: 0
  });
  y += dateSize * afterDateGap;
  y += 1; // rule
  y += Math.max(nameSize, sectionSize) * afterRuleGap;

  const gapAfterItem = nameSize * itemGap;

  if (menu.kind === 'BUFFET') {
    const list = bySection.get('BUFFET') || [];
    for (const item of list) {
      y += itemBlockHeight(doc, item, nameSize, descSize, contentWidth);
      y += gapAfterItem;
    }
  } else {
    for (const section of CONVENTIONAL_ORDER) {
      if (section === 'ENSALADA') {
        y += sectionTitleHeight(
          doc,
          MESA_ENSALADAS.toUpperCase(),
          sectionSize,
          contentWidth
        );
        y += sectionSize * sectionGap;
        continue;
      }
      const list = bySection.get(section) || [];
      if (!list.length) continue;
      y += sectionTitleHeight(
        doc,
        SECTION_LABELS[section].toUpperCase(),
        sectionSize,
        contentWidth
      );
      y += sectionSize * 0.08;

      if (section === 'POSTRE' && list.length >= POSTRE_TWO_COL_MIN) {
        const gap = 10;
        const colWidth = (contentWidth - gap) / 2;
        const mid = Math.ceil(list.length / 2);
        const leftCol = list.slice(0, mid);
        const rightCol = list.slice(mid);
        let leftH = 0;
        let rightH = 0;
        for (const item of leftCol) {
          leftH += itemBlockHeight(doc, item, nameSize, descSize, colWidth);
          leftH += gapAfterItem;
        }
        for (const item of rightCol) {
          rightH += itemBlockHeight(doc, item, nameSize, descSize, colWidth);
          rightH += gapAfterItem;
        }
        y += Math.max(leftH, rightH);
      } else {
        for (const item of list) {
          y += itemBlockHeight(doc, item, nameSize, descSize, contentWidth);
          y += gapAfterItem;
        }
      }
      y += Math.max(nameSize, sectionSize) * afterSectionGap;
    }
  }

  try {
    doc.end();
  } catch (_) {
    /* ignore */
  }

  return { finalY: y, bottomLimit, fits: y <= bottomLimit + 0.5 };
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
function drawPostreItems(doc, list, nameSize, descSize, left, contentWidth, itemGap = 0.08) {
  const gapAfter = nameSize * itemGap;

  if (list.length < POSTRE_TWO_COL_MIN) {
    for (const item of list) {
      drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
      doc.y += gapAfter;
    }
    return;
  }

  const gap = 10;
  const colWidth = (contentWidth - gap) / 2;
  const mid = Math.ceil(list.length / 2);
  const leftCol = list.slice(0, mid);
  const rightCol = list.slice(mid);
  const startY = doc.y;
  const rightX = left + colWidth + gap;

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

function paintDailyMenu(doc, menu, typo, logoPath) {
  const pageWidth = doc.page.width;
  const left = doc.page.margins.left;
  const contentWidth = pageWidth - left - doc.page.margins.right;

  const {
    nameSize,
    sectionSize,
    titleSize,
    dateSize,
    descSize,
    itemGap,
    sectionGap,
    afterSectionGap,
    afterTitleGap,
    afterDateGap,
    afterRuleGap,
    logoH,
    bandPad
  } = typo;

  const bySection = groupItems(menu.items);
  const logoW = logoPath ? logoH * LOGO_ASPECT : 0;
  const bandHeight = logoPath ? logoH + bandPad : 40;

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

  // Evita page-breaks espurios en menús densos ya dimensionados para 1 hoja.
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.y = bandHeight + 8;
  doc
    .fillColor(TEXT_DARK)
    .font('Helvetica-Bold')
    .fontSize(titleSize)
    .text('Menú', left, doc.y, { width: contentWidth, align: 'center' });
  doc.moveDown(afterTitleGap);
  doc
    .font('Helvetica')
    .fontSize(dateSize)
    .fillColor(TEXT_DARK)
    .text(formatMenuDate(menu.date), { align: 'center' });

  doc.moveDown(afterDateGap);
  doc
    .strokeColor(RIVIERA_BLUE)
    .lineWidth(1)
    .moveTo(left + 16, doc.y)
    .lineTo(pageWidth - doc.page.margins.right - 16, doc.y)
    .stroke();

  doc.moveDown(afterRuleGap);
  doc.fillColor(TEXT_DARK);

  if (menu.kind === 'BUFFET') {
    const list = bySection.get('BUFFET') || [];
    if (!list.length) {
      doc.font('Helvetica-Oblique').fontSize(descSize).fillColor(TEXT_MUTED);
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
      if (section === 'ENSALADA') {
        printed += 1;
        doc
          .fillColor(RIVIERA_BLUE)
          .font('Helvetica-Bold')
          .fontSize(sectionSize)
          .text(MESA_ENSALADAS.toUpperCase(), left, doc.y, {
            width: contentWidth,
            align: 'center',
            characterSpacing: 0.6
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
        .fontSize(sectionSize)
        .text(SECTION_LABELS[section].toUpperCase(), left, doc.y, {
          width: contentWidth,
          align: 'center',
          characterSpacing: 0.6
        });
      doc.moveDown(0.08);
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
      doc.font('Helvetica-Oblique').fontSize(descSize).fillColor(TEXT_MUTED);
      doc.text('Sin platos cargados.', { align: 'center' });
    }
  }

  doc.page.margins.bottom = savedBottom;
  return { finalY: doc.y };
}

/**
 * Mayor nameSize (pt) que cabe en 1 A5 sin overflow (medición por heightOfString).
 */
function resolveMenuTypography(menu, logoPath = resolveLogoPath()) {
  let best = {
    ...typographyForNameSize(NAME_PT_MIN),
    fits: false
  };

  for (let namePt = NAME_PT_MAX; namePt >= NAME_PT_MIN; namePt -= 1) {
    const typo = typographyForNameSize(namePt);
    const measured = measureMenuFinalY(menu, typo, logoPath);
    if (measured.fits) {
      return {
        ...typo,
        fits: true,
        finalY: measured.finalY,
        bottomLimit: measured.bottomLimit
      };
    }
  }
  return best;
}

/**
 * Genera un Buffer PDF A5 (148×210 mm) del menú diario.
 * Tipografía al máximo legible que quepa en una hoja.
 */
function buildDailyMenuPdfBuffer(menu) {
  return new Promise((resolve, reject) => {
    const logoPath = resolveLogoPath();
    const typo = resolveMenuTypography(menu, logoPath);

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

    paintDailyMenu(doc, menu, typo, logoPath);
    doc.end();
  });
}

module.exports = {
  buildDailyMenuPdfBuffer,
  resolveMenuTypography,
  typographyForNameSize,
  measureMenuFinalY,
  SECTION_LABELS,
  CONVENTIONAL_ORDER,
  MESA_ENSALADAS,
  POSTRE_TWO_COL_MIN,
  MAIN_MIN_PT,
  TITLE_PT,
  DATE_PT,
  SECTION_PT,
  TITLE_MIN_PT,
  DATE_MIN_PT,
  SECTION_MIN_PT,
  DESC_MIN_PT,
  NAME_PT_MAX,
  A5_PT,
  A4_PT
};
