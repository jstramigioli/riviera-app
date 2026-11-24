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
 * Tipografía fija: platos/secciones 16pt.
 */
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
const LOGO_H = 36;
const BAND_PAD = 8;

const LOGO_CANDIDATES = [
  path.join(__dirname, '../../assets/riviera-hotel-logo.png'),
  path.join(__dirname, '../../../frontend/public/riviera-hotel-logo.png'),
  path.join(__dirname, '../../../frontend/src/assets/riviera-hotel-logo.png'),
  path.join(__dirname, '../../assets/logo-hotel.png'),
  path.join(__dirname, '../../../frontend/src/assets/logo-hotel.png')
];

/**
 * Márgenes A5. El pie debe ser chico y comparable al aire bajo el logo
 * (bandToTitle), no al gutter lateral — si no, se lee como “bloque blanco abajo”.
 */
const PAGE_MARGINS = { top: 14, bottom: 8, left: 24, right: 24 };

/** Pisos de gap (pt). El slack se reparte encima de estos mínimos. */
const MIN_BAND_TO_TITLE = 6;
const MIN_AFTER_TITLE = 3;
const MIN_AFTER_DATE = 5;
const MIN_AFTER_RULE = 6;
const MIN_AFTER_SECTION_TITLE = 2;
const MIN_ITEM_GAP = 2;
const MIN_AFTER_SECTION = 4;

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

function fixedTypography() {
  return {
    nameSize: NAME_PT,
    sectionSize: SECTION_PT,
    titleSize: TITLE_PT,
    dateSize: DATE_PT,
    descSize: DESC_PT,
    logoH: LOGO_H,
    bandPad: BAND_PAD
  };
}

function minSpacingBase() {
  return {
    bandToTitle: MIN_BAND_TO_TITLE,
    afterTitle: MIN_AFTER_TITLE,
    afterDate: MIN_AFTER_DATE,
    afterRule: MIN_AFTER_RULE,
    afterSectionTitle: MIN_AFTER_SECTION_TITLE,
    itemGap: MIN_ITEM_GAP,
    afterSection: MIN_AFTER_SECTION
  };
}

function countFlexSlots(menu) {
  const bySection = groupItems(menu.items);
  let itemGapSlots = 0;
  let afterSectionSlots = 0;

  if (menu.kind === 'BUFFET') {
    const list = bySection.get('BUFFET') || [];
    itemGapSlots = Math.max(0, list.length - 1);
    return { itemGapSlots, afterSectionSlots, headerFlexSlots: 4 };
  }

  const blocks = [];
  for (const section of CONVENTIONAL_ORDER) {
    if (section === 'ENSALADA') {
      blocks.push({ section, saladOnly: true });
      continue;
    }
    const list = bySection.get(section) || [];
    if (!list.length) continue;
    blocks.push({ section, list, saladOnly: false });
  }

  afterSectionSlots = Math.max(0, blocks.length - 1);
  for (const block of blocks) {
    if (block.saladOnly) continue;
    if (block.section === 'POSTRE' && block.list.length >= POSTRE_TWO_COL_MIN) {
      const mid = Math.ceil(block.list.length / 2);
      itemGapSlots += Math.max(0, mid - 1);
    } else {
      itemGapSlots += Math.max(0, block.list.length - 1);
    }
  }

  // header flex: bandToTitle, afterTitle, afterDate, afterRule
  return { itemGapSlots, afterSectionSlots, headerFlexSlots: 4 };
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

function drawPostreItems(doc, list, nameSize, descSize, left, contentWidth, itemGapPt) {
  if (list.length < POSTRE_TWO_COL_MIN) {
    list.forEach((item, i) => {
      drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
      if (i < list.length - 1) doc.y += itemGapPt;
    });
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
  leftCol.forEach((item, i) => {
    leftY = drawCenteredItemAt(doc, item, nameSize, descSize, left, colWidth, leftY);
    if (i < leftCol.length - 1) leftY += itemGapPt;
  });

  let rightY = startY;
  rightCol.forEach((item, i) => {
    rightY = drawCenteredItemAt(
      doc,
      item,
      nameSize,
      descSize,
      rightX,
      colWidth,
      rightY
    );
    if (i < rightCol.length - 1) rightY += itemGapPt;
  });

  doc.page.margins.bottom = savedBottom;
  doc.x = left;
  doc.y = Math.max(leftY, rightY);
}

function paintDailyMenu(doc, menu, spacing, logoPath) {
  const pageWidth = doc.page.width;
  const left = doc.page.margins.left;
  const contentWidth = pageWidth - left - doc.page.margins.right;

  const {
    nameSize,
    sectionSize,
    titleSize,
    dateSize,
    descSize,
    logoH,
    bandPad,
    bandToTitle,
    afterTitle,
    afterDate,
    afterRule,
    afterSectionTitle,
    itemGap,
    afterSection
  } = spacing;

  const bySection = groupItems(menu.items);
  const logoW = logoPath ? logoH * LOGO_ASPECT : 0;
  const bandHeight = logoPath ? logoH + bandPad : 36;

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
      .text('Hotel Riviera', left, 10, {
        width: contentWidth,
        align: 'center'
      });
  }

  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.y = bandHeight + bandToTitle;
  doc
    .fillColor(TEXT_DARK)
    .font('Helvetica-Bold')
    .fontSize(titleSize)
    .text('Menú', left, doc.y, { width: contentWidth, align: 'center' });
  doc.y += afterTitle;
  doc
    .font('Helvetica')
    .fontSize(dateSize)
    .fillColor(TEXT_DARK)
    .text(formatMenuDate(menu.date), left, doc.y, {
      width: contentWidth,
      align: 'center'
    });

  doc.y += afterDate;
  doc
    .strokeColor(RIVIERA_BLUE)
    .lineWidth(1)
    .moveTo(left + 16, doc.y)
    .lineTo(pageWidth - doc.page.margins.right - 16, doc.y)
    .stroke();
  doc.y += 1 + afterRule;
  doc.fillColor(TEXT_DARK);

  if (menu.kind === 'BUFFET') {
    const list = bySection.get('BUFFET') || [];
    if (!list.length) {
      doc.font('Helvetica-Oblique').fontSize(descSize).fillColor(TEXT_MUTED);
      doc.text('Sin preparaciones.', { align: 'center' });
    } else {
      list.forEach((item, i) => {
        drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
        if (i < list.length - 1) doc.y += itemGap;
      });
    }
  } else {
    const blocks = [];
    for (const section of CONVENTIONAL_ORDER) {
      if (section === 'ENSALADA') {
        blocks.push({ section, saladOnly: true });
        continue;
      }
      const list = bySection.get(section) || [];
      if (!list.length) continue;
      blocks.push({ section, list, saladOnly: false });
    }

    let printed = 0;
    blocks.forEach((block, idx) => {
      printed += 1;
      if (block.saladOnly) {
        doc
          .fillColor(RIVIERA_BLUE)
          .font('Helvetica-Bold')
          .fontSize(sectionSize)
          .text(MESA_ENSALADAS.toUpperCase(), left, doc.y, {
            width: contentWidth,
            align: 'center',
            characterSpacing: 0.6
          });
      } else {
        doc
          .fillColor(RIVIERA_BLUE)
          .font('Helvetica-Bold')
          .fontSize(sectionSize)
          .text(SECTION_LABELS[block.section].toUpperCase(), left, doc.y, {
            width: contentWidth,
            align: 'center',
            characterSpacing: 0.6
          });
        doc.y += afterSectionTitle;
        if (block.section === 'POSTRE') {
          drawPostreItems(
            doc,
            block.list,
            nameSize,
            descSize,
            left,
            contentWidth,
            itemGap
          );
        } else {
          block.list.forEach((item, i) => {
            drawCenteredItem(doc, item, nameSize, descSize, left, contentWidth);
            if (i < block.list.length - 1) doc.y += itemGap;
          });
        }
      }
      if (idx < blocks.length - 1) doc.y += afterSection;
    });

    if (!printed) {
      doc.font('Helvetica-Oblique').fontSize(descSize).fillColor(TEXT_MUTED);
      doc.text('Sin platos cargados.', { align: 'center' });
    }
  }

  doc.page.margins.bottom = savedBottom;
  return { finalY: doc.y, pageCount: doc.bufferedPageRange().count };
}

function createScratchDoc() {
  const doc = new PDFDocument({
    size: A5_PT,
    margins: { ...PAGE_MARGINS },
    autoFirstPage: true
  });
  doc.on('data', () => {});
  return doc;
}

/**
 * Mide altura real pintando con gaps dados (dry-run).
 * Evita desfaces heightOfString vs text() que dejaban slack sin usar.
 */
function measurePaintedFinalY(menu, spacing, logoPath) {
  const doc = createScratchDoc();
  const result = paintDailyMenu(doc, menu, spacing, logoPath);
  try {
    doc.end();
  } catch (_) {
    /* ignore */
  }
  return result;
}

/**
 * Tipografía 16pt fija + gaps que absorben TODO el slack hasta el pie útil.
 * Prioriza aire entre secciones; el blanco no se acumula abajo.
 */
function resolveMenuSpacing(menu, logoPath = resolveLogoPath()) {
  const typo = fixedTypography();
  const bottomLimit = A5_PT[1] - PAGE_MARGINS.bottom;
  const slots = countFlexSlots(menu);

  const minSpacing = {
    ...typo,
    ...minSpacingBase()
  };

  const minPaint = measurePaintedFinalY(menu, minSpacing, logoPath);
  const solid = minPaint.finalY;
  const slack = Math.max(0, bottomLimit - solid);

  // Casi todo el slack → entre secciones. Ítems/header reciben poco.
  // Así el menú corto no “apila” vacío debajo de postres.
  const wSection = 5.0;
  const wItem = 0.55;
  const wRule = 1.1;
  const wAfterTitle = 0.45;
  const wAfterDate = 0.45;
  const wBand = 0.25;
  const wSectionTitle = 0.45;

  const sectionTitleSlots = Math.max(0, slots.afterSectionSlots); // approx non-salad separators
  const totalWeight =
    slots.afterSectionSlots * wSection +
    slots.itemGapSlots * wItem +
    wRule +
    wAfterTitle +
    wAfterDate +
    wBand +
    sectionTitleSlots * wSectionTitle;

  const unit = totalWeight > 0 ? slack / totalWeight : 0;

  const spacing = {
    ...typo,
    bandToTitle: MIN_BAND_TO_TITLE + unit * wBand,
    afterTitle: MIN_AFTER_TITLE + unit * wAfterTitle,
    afterDate: MIN_AFTER_DATE + unit * wAfterDate,
    afterRule: MIN_AFTER_RULE + unit * wRule,
    afterSectionTitle: MIN_AFTER_SECTION_TITLE + unit * wSectionTitle,
    itemGap: MIN_ITEM_GAP + unit * wItem,
    afterSection: MIN_AFTER_SECTION + unit * wSection
  };

  // Empujar al pie útil: repetir hasta residual < 1.5pt o 4 iteraciones.
  for (let i = 0; i < 4; i += 1) {
    const painted = measurePaintedFinalY(menu, spacing, logoPath);
    const shortfall = bottomLimit - painted.finalY;
    if (shortfall <= 1.25) break;
    if (slots.afterSectionSlots > 0) {
      spacing.afterSection += shortfall / slots.afterSectionSlots;
    } else {
      spacing.afterRule += shortfall;
      spacing.itemGap += shortfall * 0.15;
    }
  }

  const verify = measurePaintedFinalY(menu, spacing, logoPath);
  const bottomGap = bottomLimit - verify.finalY;

  return {
    ...spacing,
    fits: verify.finalY <= bottomLimit + 1.5 && verify.pageCount <= 1,
    solid,
    slack,
    bottomLimit,
    finalY: verify.finalY,
    pageHeight: A5_PT[1],
    itemGapSlots: slots.itemGapSlots,
    afterSectionSlots: slots.afterSectionSlots,
    bottomGap,
    /** Blanco bajo el último texto hasta el borde físico de la página. */
    bottomEdgeGap: A5_PT[1] - verify.finalY
  };
}

function resolveMenuTypography(menu, logoPath = resolveLogoPath()) {
  return resolveMenuSpacing(menu, logoPath);
}

/**
 * Genera un Buffer PDF A5 (148×210 mm) del menú diario.
 */
function buildDailyMenuPdfBuffer(menu) {
  return new Promise((resolve, reject) => {
    const logoPath = resolveLogoPath();
    const spacing = resolveMenuSpacing(menu, logoPath);

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

    paintDailyMenu(doc, menu, spacing, logoPath);
    doc.end();
  });
}

module.exports = {
  buildDailyMenuPdfBuffer,
  resolveMenuSpacing,
  resolveMenuTypography,
  fixedTypography,
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
