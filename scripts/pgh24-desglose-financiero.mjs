import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = process.argv[2] || path.resolve('media-out');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://127.0.0.1:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/reservations/9`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Scroll financial into view
  await page.locator('[data-testid="estado-financiero"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'pgh24-financiero-cerrado.png'), fullPage: false });

  const closed = await page.evaluate(() => {
    const body = document.body.innerText || '';
    return {
      hasDesgloseMontos: /Desglose de montos/i.test(body),
      hasDesglosePorNoche: /Desglose por noche/i.test(body),
      financialTotal: document.querySelector('[data-testid="financial-total-reserva"]')?.textContent?.trim() || null,
      nightsLabel: Array.from(document.querySelectorAll('*')).find((n) => {
        if (n.children.length) return false;
        return /^Noches:?$/i.test((n.textContent || '').trim());
      })?.parentElement?.textContent?.replace(/\s+/g, ' ').trim() || null,
      rowButtons: ['financial-row-total', 'financial-row-cargos', 'financial-row-pagos'].map((id) =>
        Boolean(document.querySelector(`[data-testid="${id}"]`))
      ),
    };
  });
  console.log('closed', JSON.stringify(closed, null, 2));

  // Expand Total reserva
  await page.getByTestId('financial-row-total').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="estado-financiero"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'pgh24-total-expandido.png'), fullPage: false });

  const totalExpanded = await page.evaluate(() => {
    const detail = document.querySelector('[data-testid="financial-detail-total"]');
    const aloj = document.querySelector('[data-testid="alojamiento-noches"]');
    return {
      hasDetail: Boolean(detail),
      alojText: aloj?.textContent?.replace(/\s+/g, ' ').trim() || null,
      hasDesgloseMontos: /Desglose de montos/i.test(document.body.innerText || ''),
      hasDesglosePorNoche: /Desglose por noche/i.test(document.body.innerText || ''),
      detailText: detail?.innerText?.replace(/\s+/g, ' ').trim() || null,
    };
  });
  console.log('totalExpanded', JSON.stringify(totalExpanded, null, 2));

  // Expand Cargos (collapses total)
  await page.getByTestId('financial-row-cargos').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="estado-financiero"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'pgh24-cargos-expandido.png'), fullPage: false });

  const cargosExpanded = await page.evaluate(() => ({
    hasCargosDetail: Boolean(document.querySelector('[data-testid="financial-detail-cargos"]')),
    hasTotalDetail: Boolean(document.querySelector('[data-testid="financial-detail-total"]')),
    cargosText: document.querySelector('[data-testid="financial-detail-cargos"]')?.innerText?.replace(/\s+/g, ' ').trim() || null,
  }));
  console.log('cargosExpanded', JSON.stringify(cargosExpanded, null, 2));

  // Expand Pagos
  await page.getByTestId('financial-row-pagos').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="estado-financiero"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, 'pgh24-pagos-expandido.png'), fullPage: false });

  const pagosExpanded = await page.evaluate(() => ({
    hasPagosDetail: Boolean(document.querySelector('[data-testid="financial-detail-pagos"]')),
    hasCargosDetail: Boolean(document.querySelector('[data-testid="financial-detail-cargos"]')),
    pagosText: document.querySelector('[data-testid="financial-detail-pagos"]')?.innerText?.replace(/\s+/g, ' ').trim() || null,
  }));
  console.log('pagosExpanded', JSON.stringify(pagosExpanded, null, 2));

  await browser.close();
  console.log('done', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
