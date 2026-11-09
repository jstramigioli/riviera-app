import { chromium } from 'playwright';
import path from 'path';

const mediaDir = 'C:/Users/julii/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-04f1ca1f-09c2-4eb6-9b5f-83c5b6a47bda/files/media';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
await page.goto('http://127.0.0.1:5173/reservations/9', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Estado financiero/i }).click();
await page.waitForSelector('[data-testid="btn-imprimir-liquidacion"]');
await page.evaluate(() => {
  const el = document.querySelector('[data-testid="liquidacion-print"]');
  el.style.display = 'block';
  el.style.position = 'static';
  el.style.width = '794px';
  el.style.background = '#fff';
  el.style.color = '#111';
  el.style.padding = '24px';
  el.style.margin = '0 auto';
  document.body.innerHTML = '';
  document.body.appendChild(el);
  document.body.style.background = '#fff';
});
await page.waitForTimeout(200);
await page.screenshot({
  path: path.join(mediaDir, 'pgh29-liquidacion-completa.png'),
  fullPage: true
});
await browser.close();
console.log('ok');
