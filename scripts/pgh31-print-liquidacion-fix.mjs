import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const mediaDir =
  'C:/Users/julii/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-04f1ca1f-09c2-4eb6-9b5f-83c5b6a47bda/files/media';
fs.mkdirSync(mediaDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://127.0.0.1:5173/reservations/9', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Estado financiero/i }).click();
await page.waitForSelector('[data-testid="btn-imprimir-liquidacion"]');
await page.getByTestId('financial-row-cargos').click();
await page.waitForSelector('[data-testid="financial-detail-cargos"]');

const orderNames = await page.$$eval(
  '[data-testid="financial-detail-cargos"] > ul > li',
  (lis) => lis.map((li) => {
    const span = li.querySelector(':scope > div span');
    return (span?.textContent || '').trim();
  }).filter(Boolean)
);

await page.screenshot({
  path: path.join(mediaDir, 'pgh31-cargos-orden.png'),
  fullPage: false
});

// Emulate print media with printing class and capture liquidacion
await page.evaluate(() => {
  document.body.classList.add('printing-liquidacion');
});
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(300);

const printMetrics = await page.evaluate(() => {
  const root = document.querySelector('[data-print-root]');
  const sheet = document.querySelector('[data-testid="liquidacion-print"]');
  if (!sheet) return { ok: false, reason: 'no-sheet' };
  const rs = getComputedStyle(sheet);
  const rr = root ? getComputedStyle(root) : null;
  const rect = sheet.getBoundingClientRect();
  const text = (sheet.innerText || '').slice(0, 400);
  return {
    ok: true,
    sheetDisplay: rs.display,
    sheetVisibility: rs.visibility,
    sheetPosition: rs.position,
    sheetLeft: rs.left,
    rootPosition: rr?.position,
    rootLeft: rr?.left,
    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    hasHotel: text.includes('Hotel Riviera'),
    hasLiquidacion: /Liquidaci/i.test(text),
    hasAlojamiento: /Alojamiento/i.test(text),
    hasConsumos: /Consumos/i.test(text),
    textSample: text
  };
});

await page.screenshot({
  path: path.join(mediaDir, 'pgh31-liquidacion-print-preview.png'),
  fullPage: true
});

// Also isolate sheet for a clean print-like capture
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="liquidacion-print"]');
  document.body.innerHTML = '';
  document.body.appendChild(el);
  document.body.style.background = '#fff';
  document.body.classList.add('printing-liquidacion');
});
await page.waitForTimeout(150);
await page.screenshot({
  path: path.join(mediaDir, 'pgh31-liquidacion-print-contenido.png'),
  fullPage: true
});

await browser.close();

const alojFirst =
  orderNames.length === 0 ||
  /^Alojamiento/i.test(orderNames[0]) ||
  (orderNames.some((n) => /Alojamiento/i.test(n)) &&
    orderNames.findIndex((n) => /Alojamiento/i.test(n)) <
      (orderNames.findIndex((n) => /Consumos/i.test(n)) === -1
        ? Number.MAX_SAFE_INTEGER
        : orderNames.findIndex((n) => /Consumos/i.test(n))));

const result = {
  ok:
    printMetrics.ok &&
    printMetrics.sheetDisplay === 'block' &&
    printMetrics.hasHotel &&
    printMetrics.hasLiquidacion &&
    printMetrics.rect.x > -100 &&
    printMetrics.rect.w > 100 &&
    printMetrics.rect.h > 100 &&
    alojFirst,
  orderNames,
  alojFirst,
  printMetrics
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
