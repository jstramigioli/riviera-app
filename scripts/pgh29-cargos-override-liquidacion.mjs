import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mediaDir = path.resolve(
  'C:/Users/julii/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-04f1ca1f-09c2-4eb6-9b5f-83c5b6a47bda/files/media'
);
fs.mkdirSync(mediaDir, { recursive: true });

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:3001';
const RESERVA = 9;

async function api(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${pathname} → ${res.status}: ${text}`);
  return json;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const results = {
  labels: {},
  hasReservaRow: null,
  consumoActions: {},
  override: {},
  liquidacion: {}
};

try {
  // Seed: ensure a consumo cargo exists
  const resumen0 = await api(`/api/reservation-payments/reservas/${RESERVA}/resumen`);
  let consumo = (resumen0.cargos?.items || []).find((c) => c.subcategoriaCargoId);
  if (!consumo) {
    const subs = await api('/api/subcategoria-cargo');
    const flat = Object.values(subs.data || {}).flat();
    const sub = flat.find((s) => s.tipo === 'CONSUMO') || flat[0];
    if (!sub) throw new Error('No hay subcategorías para crear consumo');
    consumo = await api(`/api/reservation-payments/reservas/${RESERVA}/cargos`, {
      method: 'POST',
      body: JSON.stringify({
        descripcion: 'Minibar prueba PGH-29',
        monto: 3500,
        subcategoriaCargoId: sub.id,
        notas: 'seed playwright'
      })
    });
  }

  let lodging = (resumen0.cargos?.items || []).find((c) => !c.subcategoriaCargoId);
  if (!lodging) throw new Error('Sin cargos de alojamiento en reserva 9');

  // Reset lodging override if any
  if (lodging.manualOverride) {
    await api(`/api/reservation-payments/cargos/${lodging.id}`, {
      method: 'PUT',
      body: JSON.stringify({ clearOverride: true })
    });
  }

  await page.goto(`${BASE}/reservations/${RESERVA}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Estado financiero/i }).click();
  await page.waitForSelector('[data-testid="estado-financiero"]');

  const text = await page.locator('[data-testid="estado-financiero"]').innerText();
  results.labels.hasCargos = /\bCargos\b/.test(text);
  results.labels.hasPagos = /\bPagos\b/.test(text);
  results.labels.hasTotalCargos = /Total cargos/i.test(text);
  results.labels.hasTotalPagos = /Total pagos/i.test(text);
  results.hasReservaRow = await page.locator('[data-testid="financial-row-total"]').count();
  results.hasPrintBtn = await page.locator('[data-testid="btn-imprimir-liquidacion"]').count();

  await page.locator('[data-testid="financial-row-cargos"]').click();
  await page.waitForSelector('[data-testid="financial-detail-cargos"]');

  await page.screenshot({
    path: path.join(mediaDir, 'pgh29-estado-financiero-cargos.png'),
    fullPage: false
  });

  // Edit lodging → override
  const editAloj = page.locator(`[data-testid="btn-edit-alojamiento-${lodging.id}"]`);
  await editAloj.click();
  await page.waitForSelector('[data-testid="input-cargo-monto"]');
  await page.fill('[data-testid="input-cargo-monto"]', '123456');
  await page.getByRole('button', { name: /Guardar cambios/i }).click();
  await page.waitForTimeout(800);

  const afterOv = await api(`/api/reservation-payments/reservas/${RESERVA}/resumen`);
  const lodgingAfter = (afterOv.cargos?.items || []).find((c) => c.id === lodging.id);
  results.override.monto = Number(lodgingAfter?.monto);
  results.override.montoOriginal = Number(lodgingAfter?.montoOriginal);
  results.override.manualOverride = Boolean(lodgingAfter?.manualOverride);

  await page.locator('[data-testid="financial-row-cargos"]').click().catch(() => {});
  if (!(await page.locator('[data-testid="financial-detail-cargos"]').isVisible())) {
    await page.locator('[data-testid="financial-row-cargos"]').click();
  }
  await page.waitForSelector(`[data-testid="manual-asterisk-${lodging.id}"]`);
  await page.screenshot({
    path: path.join(mediaDir, 'pgh29-override-asterisco.png'),
    fullPage: false
  });

  // Consumo edit/delete buttons visible
  results.consumoActions.edit = await page.locator(`[data-testid="btn-edit-cargo-${consumo.id}"]`).count();
  results.consumoActions.delete = await page.locator(`[data-testid="btn-delete-cargo-${consumo.id}"]`).count();

  await page.screenshot({
    path: path.join(mediaDir, 'pgh29-acciones-consumo.png'),
    fullPage: false
  });

  // Clear override
  page.once('dialog', (d) => d.accept());
  await page.locator(`[data-testid="btn-clear-override-${lodging.id}"]`).click();
  await page.waitForTimeout(900);
  const afterClear = await api(`/api/reservation-payments/reservas/${RESERVA}/resumen`);
  const lodgingClear = (afterClear.cargos?.items || []).find((c) => c.id === lodging.id);
  results.override.afterClear = {
    monto: Number(lodgingClear?.monto),
    manualOverride: Boolean(lodgingClear?.manualOverride)
  };

  // Re-apply override for liquidacion asterisk evidence, then print preview screenshot
  await api(`/api/reservation-payments/cargos/${lodging.id}`, {
    method: 'PUT',
    body: JSON.stringify({ monto: 123456 })
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Estado financiero/i }).click();
  await page.waitForSelector('[data-testid="btn-imprimir-liquidacion"]');

  // Capture liquidacion DOM by making it visible for screenshot
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="liquidacion-print"]');
    if (!el) return;
    el.style.display = 'block';
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '800px';
    el.style.zIndex = '99999';
    el.style.background = '#fff';
    el.style.color = '#111';
    el.style.padding = '24px';
    el.style.overflow = 'auto';
    el.style.maxHeight = '100vh';
    document.body.classList.add('printing-liquidacion');
  });
  await page.waitForTimeout(300);
  await page.locator('[data-testid="liquidacion-print"]').screenshot({
    path: path.join(mediaDir, 'pgh29-liquidacion-print.png')
  });

  results.liquidacion.visible = await page.locator('[data-testid="liquidacion-print"]').isVisible();
  results.liquidacion.hasPrintBtn = results.hasPrintBtn > 0;
  results.ok =
    results.labels.hasCargos &&
    results.labels.hasPagos &&
    !results.labels.hasTotalCargos &&
    !results.labels.hasTotalPagos &&
    results.hasReservaRow === 0 &&
    results.override.manualOverride === true &&
    results.override.monto === 123456 &&
    results.override.montoOriginal > 0 &&
    results.override.afterClear.manualOverride === false &&
    results.consumoActions.edit > 0 &&
    results.consumoActions.delete > 0 &&
    results.liquidacion.hasPrintBtn;

  console.log(JSON.stringify(results, null, 2));
  if (!results.ok) process.exitCode = 1;
} catch (err) {
  console.error('FAIL', err);
  await page.screenshot({
    path: path.join(mediaDir, 'pgh29-error.png'),
    fullPage: true
  }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
