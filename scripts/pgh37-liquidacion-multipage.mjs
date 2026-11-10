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

// Simulate the real print prep (move root to body + classes on html/body)
await page.evaluate(() => {
  const sheet = document.querySelector('[data-testid="liquidacion-print"]');
  const printRoot = sheet?.closest('[data-print-root]') || sheet;
  if (printRoot && printRoot.parentNode !== document.body) {
    document.body.appendChild(printRoot);
  }
  document.documentElement.classList.add('printing-liquidacion');
  document.body.classList.add('printing-liquidacion');
});
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(500);

const metrics = await page.evaluate(() => {
  const sheet = document.querySelector('[data-testid="liquidacion-print"]');
  const root = document.querySelector('[data-print-root]');
  if (!sheet) return { ok: false, reason: 'no-sheet' };

  const htmlCs = getComputedStyle(document.documentElement);
  const bodyCs = getComputedStyle(document.body);
  const sheetCs = getComputedStyle(sheet);
  const rootCs = root ? getComputedStyle(root) : null;
  const app = document.getElementById('root');
  const appCs = app ? getComputedStyle(app) : null;

  const text = sheet.innerText || '';
  const rect = sheet.getBoundingClientRect();
  const scrollH = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    sheet.scrollHeight,
    Math.round(rect.height)
  );

  let pagosTableRows = 0;
  for (const sec of sheet.querySelectorAll('section')) {
    const h2 = sec.querySelector('h2');
    if (h2 && /Pagos/i.test(h2.textContent || '')) {
      pagosTableRows = sec.querySelectorAll('tbody tr').length;
    }
  }

  // A4 content height ~ 1123px at 96dpi with ~14mm margins ≈ 264mm usable? 
  // Printable ~ 297 - 28 = 269mm ≈ 1017px at 96dpi
  const a4ContentPx = 1017;

  return {
    ok: true,
    htmlHeight: htmlCs.height,
    htmlOverflow: htmlCs.overflow,
    htmlOverflowY: htmlCs.overflowY,
    bodyHeight: bodyCs.height,
    bodyOverflow: bodyCs.overflow,
    bodyOverflowY: bodyCs.overflowY,
    sheetDisplay: sheetCs.display,
    sheetPosition: sheetCs.position,
    sheetOverflow: sheetCs.overflow,
    sheetMaxHeight: sheetCs.maxHeight,
    rootPosition: rootCs?.position,
    rootOverflow: rootCs?.overflow,
    rootMaxHeight: rootCs?.maxHeight,
    appDisplay: appCs?.display,
    heightPx: Math.round(rect.height),
    scrollH,
    needsMultiplePages: scrollH > a4ContentPx * 1.15,
    estimatedPages: Math.max(1, Math.ceil(scrollH / a4ContentPx)),
    hasAlojamiento: /Alojamiento/i.test(text),
    hasBebidas: /Bebidas/i.test(text),
    hasSnacks: /Snacks/i.test(text),
    hasFirma: /Firma del hu[eé]sped/i.test(text),
    hasIndividualCargoDesc: /Agua mineral|Gaseosa|Cerveza|Papas|Chocolate/i.test(text),
    pagosTableRows,
    lastLines: text.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(-6)
  };
});

const pdfPath = path.join(mediaDir, 'pgh37-liquidacion-multipage.pdf');
const pdfBuffer = await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' }
});

// Count pages via PDF page objects more carefully
const pdfText = Buffer.from(pdfBuffer).toString('latin1');
const pageObjMatches = [...pdfText.matchAll(/\/Type\s*\/Page\b/g)];
const pageCount = pageObjMatches.length;

await page.screenshot({
  path: path.join(mediaDir, 'pgh37-liquidacion-print-full.png'),
  fullPage: true
});

// Capture first "screenful" vs full to show overflow exists
await page.screenshot({
  path: path.join(mediaDir, 'pgh37-liquidacion-viewport.png'),
  fullPage: false
});

await browser.close();

const result = {
  ok:
    metrics.ok &&
    metrics.sheetDisplay === 'block' &&
    metrics.sheetPosition === 'static' &&
    metrics.rootPosition === 'static' &&
    metrics.appDisplay === 'none' &&
    metrics.htmlHeight !== '100vh' &&
    metrics.bodyHeight !== '100vh' &&
    metrics.sheetOverflow === 'visible' &&
    metrics.rootOverflow === 'visible' &&
    metrics.hasAlojamiento &&
    metrics.hasBebidas &&
    metrics.hasSnacks &&
    metrics.hasFirma &&
    !metrics.hasIndividualCargoDesc &&
    metrics.pagosTableRows >= 40 &&
    metrics.needsMultiplePages &&
    pageCount >= 2,
  pageCount,
  pdfPath,
  metrics
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
