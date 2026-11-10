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

await page.evaluate(() => {
  const sheet = document.querySelector('[data-testid="liquidacion-print"]');
  const printRoot = sheet?.closest('[data-print-root]') || sheet;
  if (printRoot && printRoot.parentNode !== document.body) {
    document.body.appendChild(printRoot);
  }
  document.body.classList.add('printing-liquidacion');
});
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(400);

const metrics = await page.evaluate(() => {
  const sheet = document.querySelector('[data-testid="liquidacion-print"]');
  if (!sheet) return { ok: false, reason: 'no-sheet' };
  const text = sheet.innerText || '';
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const hasIndividualCargoDesc =
    /Agua mineral|Gaseosa|Cerveza|Papas|Chocolate/i.test(text);
  const hasAlojamiento = /Alojamiento/i.test(text);
  const hasBebidas = /Bebidas/i.test(text);
  const hasSnacks = /Snacks/i.test(text);
  const hasFirma = /Firma del hu[eé]sped/i.test(text);
  const hasPagos = /Pagos/i.test(text);
  const pagoRows = sheet.querySelectorAll('section h2') ;
  let pagosTableRows = 0;
  const sections = [...sheet.querySelectorAll('section')];
  for (const sec of sections) {
    const h2 = sec.querySelector('h2');
    if (h2 && /Pagos/i.test(h2.textContent || '')) {
      pagosTableRows = sec.querySelectorAll('tbody tr').length;
    }
  }
  const rs = getComputedStyle(sheet);
  const root = document.querySelector('[data-print-root]');
  const rootStyle = root ? getComputedStyle(root) : null;
  const rect = sheet.getBoundingClientRect();
  return {
    ok: true,
    sheetDisplay: rs.display,
    sheetPosition: rs.position,
    rootPosition: rootStyle?.position,
    heightPx: Math.round(rect.height),
    hasAlojamiento,
    hasBebidas,
    hasSnacks,
    hasFirma,
    hasPagos,
    hasIndividualCargoDesc,
    pagosTableRows,
    firmaIndex: lines.findIndex((l) => /Firma del hu[eé]sped/i.test(l)),
    lastLines: lines.slice(-8),
    sample: lines.slice(0, 25)
  };
});

const pdfPath = path.join(mediaDir, 'pgh37-liquidacion-multipage.pdf');
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' }
});

await page.screenshot({
  path: path.join(mediaDir, 'pgh37-liquidacion-print-full.png'),
  fullPage: true
});

// Isolate sheet for clean capture (optional)
try {
  const moved = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="liquidacion-print"]');
    if (!el) return false;
    document.body.replaceChildren(el);
    document.body.style.background = '#fff';
    document.body.classList.add('printing-liquidacion');
    return true;
  });
  if (moved) {
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(mediaDir, 'pgh37-liquidacion-contenido.png'),
      fullPage: true
    });
  }
} catch (err) {
  console.error('isolate-capture-skip:', err.message);
}

const pdfBytes = fs.readFileSync(pdfPath);
const pdfText = pdfBytes.toString('latin1');
const pageCountMatch = pdfText.match(/\/Type\s*\/Page[^s]/g);
const pageCount = pageCountMatch ? pageCountMatch.length : null;

await browser.close();

const result = {
  ok:
    metrics.ok &&
    metrics.sheetDisplay === 'block' &&
    metrics.rootPosition === 'static' &&
    metrics.hasAlojamiento &&
    metrics.hasBebidas &&
    metrics.hasSnacks &&
    metrics.hasFirma &&
    metrics.hasPagos &&
    !metrics.hasIndividualCargoDesc &&
    metrics.pagosTableRows >= 40 &&
    (pageCount == null || pageCount >= 2),
  pageCount,
  pdfPath,
  metrics
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
