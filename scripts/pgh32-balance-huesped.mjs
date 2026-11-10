import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const mediaDir =
  'C:/Users/julii/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-04f1ca1f-09c2-4eb6-9b5f-83c5b6a47bda/files/media';
fs.mkdirSync(mediaDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const balanceApi = await page.request.get('http://127.0.0.1:3001/api/clients/1212/balance');
const balanceJson = await balanceApi.json();
const resumenApi = await page.request.get('http://127.0.0.1:3001/api/reservation-payments/reservas/9/resumen');
const resumenJson = await resumenApi.json();

// Perfil cliente / huésped
await page.goto('http://127.0.0.1:5173/clients/1212', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({
  path: path.join(mediaDir, 'pgh32-perfil-saldo-favor.png'),
  fullPage: false,
});

// Sección balance
const balanceTab = page.getByRole('button', { name: /Balance/i }).first();
if (await balanceTab.count()) {
  await balanceTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(mediaDir, 'pgh32-perfil-seccion-balance.png'),
    fullPage: false,
  });
}

// Reserva: estado financiero (misma fuente)
await page.goto('http://127.0.0.1:5173/reservations/9', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const finBtn = page.getByRole('button', { name: /Estado financiero/i });
if (await finBtn.count()) {
  await finBtn.click();
  await page.waitForTimeout(500);
}
await page.screenshot({
  path: path.join(mediaDir, 'pgh32-reserva-saldo-favor.png'),
  fullPage: false,
});

const checks = {
  ok:
    balanceJson.balance === -10000 &&
    resumenJson.resumen?.saldo === -10000 &&
    balanceJson.balance === resumenJson.resumen.saldo &&
    balanceJson.isDebtor === false,
  clientBalance: balanceJson,
  reservaResumen: resumenJson.resumen,
  screenshots: [
    'media/pgh32-perfil-saldo-favor.png',
    'media/pgh32-perfil-seccion-balance.png',
    'media/pgh32-reserva-saldo-favor.png',
  ],
};

console.log(JSON.stringify(checks, null, 2));
await browser.close();
process.exit(checks.ok ? 0 : 1);
