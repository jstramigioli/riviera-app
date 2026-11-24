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
 * Tipografía fija pedida por Julián: platos/secciones 16pt.
 * Título un poco mayor; fecha/notas legibles pero subordinadas.
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
const LOGO_H = 40;
const BAND_PAD = 10;

const LOGO_CANDIDATES = [
  path.join(__dirname, '../../assets/riviera-hotel-logo.png'),
  path.join(__dirname, '../../../frontend/public/riviera-hotel-logo.png'),
  path.join(__dirname, '../../../frontend/src/assets/riviera-hotel-logo.png'),
  path.join(__dirname, '../../assets/logo-hotel.png'),
  path.join(__dirname, '../../../frontend/src/assets/logo-hotel.png')
];

const PAGE_MARGINS = { top: 20, bottom: 20, left: 28, right: 28 };

/** Pisos de gap (pt). El slack restante se reparte entre slots flexibles. */
const MIN_AFTER_TITLE = 4;
const MIN_AFTER_DATE = 6;
const MIN_AFTER_RULE = 8;
const MIN_AFTER_SECTION_TITLE = 3;
const MIN_ITEM_GAP = 3;
const MIN_AFTER_SECTION = 6;
const MIN_BAND_TO_TITLE = 8;

/** Techos para que menús muy vacíos no queden excesivamente aireados. */
const MAX_ITEM_GAP = 18;
const MAX_AFTER_SECTION = 28;
const MAX_AFTER_RULE = 22;

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

function postreBlockHeight(doc, list, nameSize, descSize, contentWidth, itemGapPt) {
  if (!list.length) return 0;
  if (list.length < POSTRE_TWO_COL_MIN) {
    let h = 0;
    list.forEach((item, i) => {
      h += itemBlockHeight(doc, item, nameSize, descSize, contentWidth);
      if (i < list.length - 1) h += itemGapPt;
    });
    return h;
  }
  const colWidth = (contentWidth - COL_GAP) / 2;
  const mid = Math.ceil(list.length / 2);
  const leftCol = list.slice(0, mid);
  const rightCol = list.slice(mid);
  const colH = (col) => {
    let h = 0;
    col.forEach((item, i) => {
      h += itemBlockHeight(doc, item, nameSize, descSize, colWidth);
      if (i < col.length - 1) h += itemGapPt;
    });
    return h;
  };
  return Math.max(colH(leftCol), colH(rightCol));
}

/**
 * Cuenta slots flexibles y altura sólida (texto + gaps mínimos).
 * Devuelve gaps en pt ya repartidos para llenar la hoja sin acumular vacío abajo.
 */
function resolveMenuSpacing(menu, logoPath = resolveLogoPath()) {
  const typo = fixedTypography();
  const doc = new PDFDocument({
    size: A5_PT,
    margins: { ...PAGE_MARGINS },
    autoFirstPage: true
  });
  doc.on('data', () => {});

  const pageWidth = A5_PT[0];
  const contentWidth = pageWidth - PAGE_MARGINS.left - PAGE_MARGINS.right;
  const bottomLimit = A5_PT[1] - PAGE_MARGINS.bottom;
  const bySection = groupItems(menu.items);
  const bandHeight = logoPath ? typo.logoH + typo.bandPad : 40;

  let solid = bandHeight + MIN_BAND_TO_TITLE;
  doc.font('Helvetica-Bold').fontSize(typo.titleSize);
  solid += doc.heightOfString('Menú', { width: contentWidth, lineGap: 0 });
  solid += MIN_AFTER_TITLE;
  doc.font('Helvetica').fontSize(typo.dateSize);
  solid += doc.heightOfString(formatMenuDate(menu.date) || ' ', {
    width: contentWidth,
    lineGap: 0
  });
  solid += MIN_AFTER_DATE;
  solid += 1; // rule
  solid += MIN_AFTER_RULE;

  // Slots flexibles: header (rule→body) + entre secciones + entre ítems
  let flexSlots = 1; // after-rule absorbs slack
  let itemGapSlots = 0;
  let afterSectionSlots = 0;

  if (menu.kind === 'BUFFET') {
    const list = bySection.get('BUFFET') || [];
    list.forEach((item, i) => {
      solid += itemBlockHeight(doc, item, typo.nameSize, typo.descSize, contentWidth);
      if (i < list.length - 1) {
        solid += MIN_ITEM_GAP;
        itemGapSlots += 1;
      }
    });
  } else {
    const presentSections = [];
    for (const section of CONVENTIONAL_ORDER) {
      if (section === 'ENSALADA') {
        presentSections.push({ section, list: null, saladOnly: true });
        continue;
      }
      const list = bySection.get(section) || [];
      if (!list.length) continue;
      presentSections.push({ section, list, saladOnly: false });
    }

    presentSections.forEach((block, idx) => {
      if (block.saladOnly) {
        solid += sectionTitleHeight(
          doc,
          MESA_ENSALADAS.toUpperCase(),
          typo.sectionSize,
          contentWidth
        );
      } else {
        solid += sectionTitleHeight(
          doc,
          SECTION_LABELS[block.section].toUpperCase(),
          typo.sectionSize,
          contentWidth
        );
        solid += MIN_AFTER_SECTION_TITLE;
        if (block.section === 'POSTRE') {
          solid += postreBlockHeight(
            doc,
            block.list,
            typo.nameSize,
            typo.descSize,
            contentWidth,
            MIN_ITEM_GAP
          );
          if (block.list.length >= POSTRE_TWO_COL_MIN) {
            const mid = Math.ceil(block.list.length / 2);
            itemGapSlots += Math.max(0, mid - 1);
            // right col gaps are parallel — no extra vertical slots
          } else {
            itemGapSlots += Math.max(0, block.list.length - 1);
          }
        } else {
          block.list.forEach((item, i) => {
            solid += itemBlockHeight(
              doc,
              item,
              typo.nameSize,
              typo.descSize,
              contentWidth
            );
            if (i < block.list.length - 1) {
              solid += MIN_ITEM_GAP;
              itemGapSlots += 1;
            }
          });
        }
      }
      if (idx < presentSections.length - 1) {
        solid += MIN_AFTER_SECTION;
        afterSectionSlots += 1;
      }
    });
  }

  flexSlots += itemGapSlots + afterSectionSlots;

  const slack = Math.max(0, bottomLimit - solid);
  // Pesos: más aire entre secciones que entre ítems; el after-rule también crece.
  const weightRule = 1.4;
  const weightSection = 1.6;
  const weightItem = 1;
  const totalWeight =
    weightRule + afterSectionSlots * weightSection + itemGapSlots * weightItem;

  const unit = totalWeight > 0 ? slack / totalWeight : 0;

  let afterRule = Math.min(MAX_AFTER_RULE, MIN_AFTER_RULE + unit * weightRule);
  let afterSection = Math.min(
    MAX_AFTER_SECTION,
    MIN_AFTER_SECTION + unit * weightSection
  );
  let itemGap = Math.min(MAX_ITEM_GAP, MIN_ITEM_GAP + unit * weightItem);

  // Si los techos dejan slack sin usar, repartir el resto solo en after-section
  // (y rule) para no dejar vacío abajo.
  const usedExtra =
    (afterRule - MIN_AFTER_RULE) +
    afterSectionSlots * (afterSection - MIN_AFTER_SECTION) +
    itemGapSlots * (itemGap - MIN_ITEM_GAP);
  let leftover = slack - usedExtra;
  if (leftover > 0.5 && afterSectionSlots > 0) {
    const bump = leftover / (afterSectionSlots + (weightRule > 0 ? 1 : 0));
    afterSection += bump;
    afterRule += bump;
    leftover = 0;
  } else if (leftover > 0.5) {
    afterRule += leftover;
  }

  try {
    doc.end();
  } catch (_) {
    /* ignore */
  }

  return {
    ...typo,
    fits: solid <= bottomLimit + 0.5,
    solid,
    slack,
    bottomLimit,
    afterTitle: MIN_AFTER_TITLE,
    afterDate: MIN_AFTER_DATE,
    afterRule,
    afterSectionTitle: MIN_AFTER_SECTION_TITLE,
    itemGap,
    afterSection,
    bandToTitle: MIN_BAND_TO_TITLE,
    itemGapSlots,
    afterSectionSlots
  };
}

/** @deprecated nombre: ahora fija 16pt + gaps fluidos. */
function resolveMenuTypography(menu, logoPath = resolveLogoPath()) {
  return resolveMenuSpacing(menu, logoPath);
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
      .fontSize(14)
      .text('Hotel Riviera', left, 12, {
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
  return { finalY: doc.y };
}

/**
 * Genera un Buffer PDF A5 (148×210 mm) del menú diario.
 * Platos/secciones 16pt; el aire vertical se reparte según la cantidad de platos.
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
