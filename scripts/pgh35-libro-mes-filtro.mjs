import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const mediaDir =
  'C:/Users/julii/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-04f1ca1f-09c2-4eb6-9b5f-83c5b6a47bda/files/media';
fs.mkdirSync(mediaDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto('http://127.0.0.1:5173/libro-de-reservas', { waitUntil: 'networkidle' });
await page.waitForSelector('button:has-text("Hoy")', { timeout: 25000 });
await page.waitForSelector('[class*="monthLabel"]', { timeout: 15000 });
await page.waitForTimeout(600);

const filterBtn = page.locator('button[aria-label="Filtrar por tipo de habitación"]');
await filterBtn.waitFor({ timeout: 10000 });

const before = await page.evaluate(() => {
  const LABEL_W = 140;
  const scroller = document.querySelector('[class*="scroller"]');
  const monthLabels = [...document.querySelectorAll('[class*="monthLabel"]')];
  const rows = [...document.querySelectorAll('[class*="roomRow"]')];
  const filter = document.querySelector('button[aria-label="Filtrar por tipo de habitación"]');
  const svg = filter?.querySelector('svg');
  return {
    rowCount: rows.length,
    monthLabelCount: monthLabels.length,
    monthLabels: monthLabels.slice(0, 4).map((el) => el.textContent.trim()),
    hasFilterBtn: Boolean(filter),
    filterIsSvg: Boolean(svg),
    filterTag: filter?.tagName || null,
    emojiInFilter: filter ? /\p{Extended_Pictographic}/u.test(filter.textContent || '') : null,
    scrollerScrollLeft: scroller?.scrollLeft ?? null,
    labelLeftSticky: monthLabels[0]
      ? getComputedStyle(monthLabels[0]).position + '@' + getComputedStyle(monthLabels[0]).left
      : null,
    monthCellOverflow: (() => {
      const cell = document.querySelector('[class*="monthCell"]');
      return cell ? getComputedStyle(cell).overflow : null;
    })()
  };
});

// Scroll horizontal toward end of first month to check sticky tope
const stickyCheck = await page.evaluate(() => {
  const CELL = 42;
  const LABEL_W = 140;
  const scroller = document.querySelector('[class*="scroller"]');
  const monthCells = [...document.querySelectorAll('[class*="monthCell"]')];
  if (!scroller || !monthCells.length) return { ok: false, reason: 'missing nodes' };

  const first = monthCells[0];
  const firstWidth = first.getBoundingClientRect().width;
  // Scroll so only ~3 days of first month remain visible after the room label
  const target = Math.max(0, firstWidth - 3 * CELL);
  scroller.scrollLeft = target;

  const label = first.querySelector('[class*="monthLabel"]');
  const scRect = scroller.getBoundingClientRect();
  const labelRect = label.getBoundingClientRect();
  const cellRect = first.getBoundingClientRect();

  // Label should still be visible and stuck near the left edge of the days area
  const stuckNearLabelCol =
    Math.abs(labelRect.left - (scRect.left + LABEL_W)) < 8 ||
    // near month end: sticky constrained by cell right edge → label still fully inside cell
    (labelRect.right <= cellRect.right + 1 && labelRect.left >= cellRect.left - 1);

  const visibleInViewport =
    labelRect.bottom > scRect.top &&
    labelRect.top < scRect.bottom &&
    labelRect.right > scRect.left + LABEL_W &&
    labelRect.left < scRect.right;

  return {
    ok: true,
    scrollLeft: scroller.scrollLeft,
    firstMonthWidth: firstWidth,
    labelText: label?.textContent?.trim() || null,
    labelLeft: Math.round(labelRect.left),
    expectedStickyLeft: Math.round(scRect.left + LABEL_W),
    cellRight: Math.round(cellRect.right),
    stuckNearLabelCol,
    visibleInViewport,
    labelFullyInCell: labelRect.left >= cellRect.left - 1 && labelRect.right <= cellRect.right + 2
  };
});

await page.waitForTimeout(200);
const shotSticky = path.join(mediaDir, 'pgh35-mes-sticky.png');
await page.screenshot({ path: shotSticky, fullPage: false });

// Reset scroll a bit, open filter, uncheck all but one type
await page.evaluate(() => {
  const scroller = document.querySelector('[class*="scroller"]');
  if (scroller) scroller.scrollLeft = 0;
});
await filterBtn.click();
await page.waitForSelector('[class*="filterMenu"]', { timeout: 5000 });

const menuInfo = await page.evaluate(() => {
  const opts = [...document.querySelectorAll('[class*="filterOption"]')];
  return {
    optionCount: opts.length,
    options: opts.map((o) => o.textContent.trim())
  };
});

// Uncheck every type except the first (Triple typically)
const checkboxes = page.locator('[class*="filterMenu"] input[type="checkbox"]');
const count = await checkboxes.count();
for (let i = 1; i < count; i++) {
  await checkboxes.nth(i).click();
}
await page.waitForTimeout(300);

const afterFilter = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[class*="roomRow"]')];
  const names = rows.map((r) => r.querySelector('[class*="roomName"]')?.textContent?.trim());
  const filter = document.querySelector('button[aria-label="Filtrar por tipo de habitación"]');
  const active = filter?.className?.includes('filterBtnActive') || filter?.className?.includes('Active');
  return {
    rowCount: rows.length,
    sampleNames: names.slice(0, 8),
    filterActiveClass: Boolean(active),
    menuOpen: Boolean(document.querySelector('[class*="filterMenu"]'))
  };
});

const shotFilter = path.join(mediaDir, 'pgh35-filtro-tipo.png');
await page.screenshot({ path: shotFilter, fullPage: false });

// Clear filter
await page.locator('[class*="filterClear"]').click({ force: true });
await page.waitForTimeout(200);
const afterClear = await page.evaluate(() => ({
  rowCount: document.querySelectorAll('[class*="roomRow"]').length
}));

const result = {
  ok:
    before.hasFilterBtn &&
    before.filterIsSvg &&
    before.monthCellOverflow === 'visible' &&
    stickyCheck.visibleInViewport &&
    stickyCheck.labelFullyInCell &&
    afterFilter.rowCount < before.rowCount &&
    afterClear.rowCount === before.rowCount,
  before,
  stickyCheck,
  menuInfo,
  afterFilter,
  afterClear,
  shots: { shotSticky, shotFilter }
};

console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.ok ? 0 : 1);
