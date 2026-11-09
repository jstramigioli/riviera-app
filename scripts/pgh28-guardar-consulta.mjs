import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = process.argv[2] || path.resolve('media-out');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:3001/api';

async function countQueries() {
  const res = await fetch(`${API}/queries`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : data.data || [];
  return arr.length;
}

async function countReservationsPendiente() {
  const res = await fetch(`${API}/reservations`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : data.data || data.reservations || [];
  return arr.filter((r) => String(r.status || '').toUpperCase() === 'PENDIENTE').length;
}

async function main() {
  const queriesBefore = await countQueries();
  const pendienteBefore = await countReservationsPendiente();
  console.log({ queriesBefore, pendienteBefore });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('dialog', async (dialog) => {
    console.log('dialog:', dialog.message());
    await dialog.accept();
  });

  await page.goto(`${BASE}/consulta`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  // Buscar cliente sin consultas recientes (Hector Campagna)
  const search = page.locator('input[placeholder*="Buscar por nombre"]');
  await search.fill('Hector Campagna');
  await page.waitForTimeout(600);
  const option = page.locator('text=Hector Campagna').first();
  await option.click();
  await page.waitForTimeout(800);

  // Si aparece modal de consultas recientes, crear nueva
  const nuevaBtn = page.getByRole('button', { name: /Crear nueva consulta/i });
  if (await nuevaBtn.isVisible().catch(() => false)) {
    await nuevaBtn.click();
    await page.waitForTimeout(500);
  }

  // Asegurar fechas en segmento (pueden venir por default)
  const dateInputs = page.locator('input[type="date"]');
  const dateCount = await dateInputs.count();
  console.log('dateInputs', dateCount);
  if (dateCount >= 2) {
    const checkIn = await dateInputs.nth(0).inputValue();
    const checkOut = await dateInputs.nth(1).inputValue();
    console.log({ checkIn, checkOut });
    if (!checkIn || !checkOut) {
      const start = new Date();
      start.setDate(start.getDate() + 30);
      const end = new Date(start);
      end.setDate(end.getDate() + 2);
      const fmt = (d) => d.toISOString().slice(0, 10);
      await dateInputs.nth(0).fill(fmt(start));
      await dateInputs.nth(1).fill(fmt(end));
      await page.waitForTimeout(500);
    }
  }

  // Scroll a botones de acción
  const saveBtn = page.getByRole('button', { name: /Guardar consulta/i });
  await saveBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const buttonsState = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('button')).map((b) =>
      (b.textContent || '').replace(/\s+/g, ' ').trim()
    );
    return {
      hasGuardarConsulta: texts.some((t) => /Guardar consulta/i.test(t)),
      hasCrearReserva: texts.some((t) => /Crear Reserva/i.test(t)),
      hasCopiar: texts.some((t) => /Copiar Datos/i.test(t)),
      guardarDisabled: Array.from(document.querySelectorAll('button')).find((b) =>
        /Guardar consulta/i.test(b.textContent || '')
      )?.disabled,
    };
  });
  console.log('buttonsState', JSON.stringify(buttonsState));

  await page.screenshot({
    path: path.join(OUT, 'pgh28-consulta-boton-guardar.png'),
    fullPage: false,
  });

  // Crop zona de botones
  const container = page.locator('button:has-text("Guardar consulta")').locator('xpath=..');
  if (await container.count()) {
    await container.screenshot({ path: path.join(OUT, 'pgh28-botones-accion.png') });
  }

  await saveBtn.click();
  await page.waitForTimeout(2500);

  // Debería navegar a consultas-reservas
  console.log('url after save', page.url());
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(OUT, 'pgh28-consultas-listado.png'),
    fullPage: false,
  });

  const queriesAfter = await countQueries();
  const pendienteAfter = await countReservationsPendiente();
  console.log({
    queriesAfter,
    queriesDelta: queriesAfter - queriesBefore,
    pendienteAfter,
    pendienteDelta: pendienteAfter - pendienteBefore,
  });

  // Recuperar: click primera fila de consultas si hay
  const row = page.locator('table tbody tr').first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(2000);
    console.log('url after recover', page.url());
    await page.screenshot({
      path: path.join(OUT, 'pgh28-consulta-recuperada.png'),
      fullPage: false,
    });
  }

  await browser.close();
  console.log('done', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
