/**
 * Regenera backend/data/tarifas-2026-27.json desde el Excel fuente.
 *
 * Uso:
 *   cd backend
 *   npm install   # necesita 'xlsx'
 *   node scripts/extract-tarifas-2026-27.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const XLSX_PATH = path.join(__dirname, '../data/Calculadora_de_tarifas_Hotel_Riviera_2026_27.xlsx');
const OUT_PATH = path.join(__dirname, '../data/tarifas-2026-27.json');

const SERVICES = [
  { key: 'solo_alojamiento', name: 'Solo Alojamiento', excelHeader: 'Sin desayuno', description: 'Sin desayuno (base)', orderIndex: 0 },
  { key: 'desayuno_riviera', name: 'Desayuno Riviera', excelHeader: 'Desayuno Riviera', description: 'Incluye desayuno Riviera', orderIndex: 1 },
  { key: 'media_pension', name: 'Desayuno y Media Pensión', excelHeader: 'Desayuno Riviera Y Media Pensión', description: 'Desayuno Riviera y media pensión', orderIndex: 2 },
];

const ROOM_TYPE_ORDER = [
  ['Single', 'single', 1, 1],
  ['Doble', 'doble', 2, 2],
  ['Triple', 'triple', 3, 3],
  ['Cuádruple', 'cuadruple', 4, 4],
  ['Quíntuple', 'quintuple', 5, 5],
];

const DEPT_MAX = { 'El Tilo': 5, 'El Romerito': 2, 'Via 1': 4, Esquinita: 4 };
const DEPT_APP_NAMES = {
  'El Tilo': 'departamento El Tilo',
  'El Romerito': 'departamento El Romerito',
  'Via 1': 'departamento Via 1',
  Esquinita: 'departamento La Esquinita',
};

function cell(sheet, r, c) {
  const ref = XLSX.utils.encode_cell({ r, c });
  const cellObj = sheet[ref];
  return cellObj ? cellObj.v : null;
}

function excelDateToIso(v) {
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(v);
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  }
  if (typeof v === 'string') return v.slice(0, 10);
  return null;
}

function shiftYear(iso, delta = 1) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(y + delta).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function sheetPrices(sheet) {
  const hotelRooms = {};
  for (let r = 7; r <= 11; r += 1) {
    const name = cell(sheet, r, 2);
    if (!name) continue;
    hotelRooms[String(name).trim()] = {
      solo_alojamiento: Number(cell(sheet, r, 3)),
      desayuno_riviera: Number(cell(sheet, r, 4)),
      media_pension: Number(cell(sheet, r, 5)),
    };
  }

  const departments = {};
  let current = null;
  for (let r = 15; r <= 29; r += 1) {
    const label = cell(sheet, r, 2);
    const people = cell(sheet, r, 3);
    const base = cell(sheet, r, 4);
    const des = cell(sheet, r, 5);
    const mp = cell(sheet, r, 6);
    if (label && String(label).trim() && String(label).trim() !== 'Departamentos') {
      current = String(label).trim();
      departments[current] = departments[current] || { byOccupancy: {} };
    }
    if (current && people != null && base != null) {
      departments[current].byOccupancy[String(Number(people))] = {
        solo_alojamiento: Number(base),
        desayuno_riviera: Number(des),
        media_pension: Number(mp),
      };
    }
  }

  for (const [name, data] of Object.entries(departments)) {
    const maxP = DEPT_MAX[name];
    const occ = data.byOccupancy;
    const chosen = occ[String(maxP)] || occ[Object.keys(occ).sort((a, b) => a - b).at(-1)];
    data.seedOccupancy = Number(maxP || Object.keys(occ).sort((a, b) => a - b).at(-1));
    data.seedPrices = chosen;
    data.roomTypeName = DEPT_APP_NAMES[name] || `departamento ${name}`;
    data.displayName = name === 'Esquinita' ? 'La Esquinita' : name;
  }

  const ref = cell(sheet, 4, 4);
  return {
    referenceDobleDesayuno: ref != null ? Number(ref) : null,
    hotelRooms,
    departments,
  };
}

function pricesForValor(tiers, valorKey) {
  const tier = tiers[valorKey];
  const out = [];
  for (const [excelName, appName] of ROOM_TYPE_ORDER.map((x) => [x[0], x[1]])) {
    const prices = tier.hotelRooms[excelName];
    for (const [sk, price] of Object.entries(prices)) {
      out.push({ roomTypeName: appName, serviceKey: sk, basePrice: price });
    }
  }
  for (const [excelDept, appName] of Object.entries(DEPT_APP_NAMES)) {
    const dept = tier.departments[excelDept];
    for (const [sk, price] of Object.entries(dept.seedPrices)) {
      out.push({
        roomTypeName: appName,
        serviceKey: sk,
        basePrice: price,
        occupancyUsed: dept.seedOccupancy,
      });
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Excel no encontrado: ${XLSX_PATH}`);
  }

  const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
  const tiers = {};
  for (const [sheetName, key] of [
    ['Valor A', 'A'],
    ['Valor B', 'B'],
    ['Valor C', 'C'],
    ['Valor D', 'D'],
    ['Diversidad cultural', 'DIVERSIDAD'],
  ]) {
    tiers[key] = { sheet: sheetName, ...sheetPrices(wb.Sheets[sheetName]) };
  }

  const impresion = wb.Sheets.impresion;
  const calendarRaw = [];
  for (let r = 1; r <= 6; r += 1) {
    const start = cell(impresion, r, 0);
    const end = cell(impresion, r, 2);
    const valor = cell(impresion, r, 3);
    if (!start || !valor) continue;
    calendarRaw.push({
      start: excelDateToIso(start),
      end: excelDateToIso(end),
      valor: String(valor).trim(),
    });
  }

  const fixed = calendarRaw.map((row, i) => {
    let { start, end, valor } = row;
    if (i === calendarRaw.length - 1 && start.startsWith('2025-03')) {
      start = start.replace('2025-', '2026-');
      end = end.replace('2025-', '2026-');
    }
    return { start: shiftYear(start), end: shiftYear(end), valor };
  });

  const labels = ['apertura', 'navidad', 'fin de año', 'alta', 'febrero', 'cierre'];
  const seasonBlocks = fixed.map((row, i) => ({
    name: `2026/27 · Valor ${row.valor} (${labels[i]})`,
    description: `[seed:tarifas-2026-27] Temporada valor ${row.valor} — ${labels[i]}. Fuente Excel hojas Valor ${row.valor} / impresion (+1 año).`,
    startDate: row.start,
    endDate: row.end,
    valor: row.valor,
    orderIndex: i,
    isDraft: false,
    prices: pricesForValor(tiers, row.valor),
  }));

  const opStart = fixed[0].start;
  const opEnd = fixed[fixed.length - 1].end;

  const roomTypes = ROOM_TYPE_ORDER.map(([excelName, appName, maxPeople, orderIndex]) => ({
    name: appName,
    displayName: excelName,
    excelName,
    maxPeople,
    orderIndex,
    kind: 'hotel',
  }));
  let order = 10;
  for (const [excelDept, appName] of Object.entries(DEPT_APP_NAMES)) {
    roomTypes.push({
      name: appName,
      displayName: excelDept === 'Esquinita' ? 'La Esquinita' : excelDept,
      excelName: excelDept,
      maxPeople: DEPT_MAX[excelDept],
      orderIndex: order,
      kind: 'departamento',
    });
    order += 1;
  }

  const diversidad = {
    name: '2026/27 · Diversidad cultural',
    description:
      '[seed:tarifas-2026-27] Tarifa especial Diversidad cultural (sin fechas de calendario en el Excel; se crea como borrador).',
    valor: 'DIVERSIDAD',
    isDraft: true,
    startDate: opStart,
    endDate: opEnd,
    orderIndex: 99,
    prices: pricesForValor(tiers, 'DIVERSIDAD'),
    includeByDefault: false,
  };

  const payload = {
    meta: {
      seedTag: 'tarifas-2026-27',
      sourceFile: 'backend/data/Calculadora_de_tarifas_Hotel_Riviera_2026_27.xlsx',
      extractedAt: new Date().toISOString(),
      notes: [
        "Calendario tomado de hoja 'impresion' desplazado +1 año → temporada 2026/27.",
        'Última fila de impresion con año 2025 en marzo se normalizó a 2026 antes del +1.',
        "Precios de hojas Valor A/B/C/D (no de 'impresion').",
        'Departamentos: SeasonPrice usa ocupación = maxPeople del tipo.',
        'Servicios: Sin desayuno→Solo Alojamiento; Desayuno Riviera; Desayuno+MP→Desayuno y Media Pensión.',
        'percentageAdjustment=0: SeasonPrice ya es precio final ARS.',
        'Diversidad cultural solo con --with-diversidad.',
      ],
      operationalPeriod: { startDate: opStart, endDate: opEnd, label: 'Temporada 2026/27' },
      impresionRaw: calendarRaw,
      calendar2026_27: fixed,
    },
    hotel: {
      id: 'default-hotel',
      name: 'Hotel Riviera',
      description: 'Hotel Riviera — seed tarifas 2026/27',
    },
    roundingConfig: { multiple: 1000, mode: 'ceil', note: 'Excel usa CEILING(...,1000)' },
    serviceTypes: SERVICES,
    roomTypes,
    seasonBlocks,
    diversidadCultural: diversidad,
    tiers: Object.fromEntries(
      Object.entries(tiers).map(([k, v]) => [
        k,
        {
          sheet: v.sheet,
          referenceDobleDesayuno: v.referenceDobleDesayuno,
          hotelRooms: v.hotelRooms,
          departments: v.departments,
        },
      ])
    ),
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUT_PATH}`);
  seasonBlocks.forEach((b) => {
    console.log(`  ${b.name}: ${b.startDate} → ${b.endDate} (${b.prices.length} prices)`);
  });
}

main();
