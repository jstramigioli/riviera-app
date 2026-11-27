/**
 * Día civil canónico para el calendario (wire yyyy-MM-dd).
 * No usar toISOString() como identidad de día en UI/API de calendario.
 *
 * Fecha debug: el FE envía `X-Simulated-Today: yyyy-MM-dd` cuando el FAB
 * de fecha simulada está activo. Toda lógica de “hoy” del hotel debe usar
 * todayIsoLocal(req) / nowLocal(req) / parseFechaInput(..., req).
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Header HTTP (Node lo normaliza a minúsculas). */
const SIMULATED_TODAY_HEADER = 'x-simulated-today';

/** @param {Date|string} input */
function toDateOnlyUtc(input) {
  if (typeof input === 'string') {
    const iso = input.length >= 10 ? input.slice(0, 10) : input;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

/** @param {Date|string} input @returns {string} yyyy-MM-dd */
function isoDate(input) {
  const d = toDateOnlyUtc(input);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** @param {string} iso yyyy-MM-dd @param {number} days */
function shiftIso(iso, days) {
  const d = toDateOnlyUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/**
 * Parsea un DateTime de Prisma / ISO a día civil yyyy-MM-dd
 * usando la parte de calendario UTC (consistente con almacenamiento típico a medianoche UTC).
 */
function civilFromDb(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return isoDate(value);
}

function daysBetweenCivil(aIso, bIso) {
  const a = toDateOnlyUtc(aIso).getTime();
  const b = toDateOnlyUtc(bIso).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** Reloj real del servidor (ignora simulación). */
function realTodayIsoLocal() {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

/**
 * La fecha simulada es una herramienta de debug solo para ADMIN (CLAUDE.md §5).
 * `req.user` lo setea requireAuth con el rol real de la sesión (la simulación de rol
 * es solo del FE), así otro rol no puede fechar cobros/caja enviando el header.
 * @param {import('express').Request|null|undefined} req
 * @returns {string|null} yyyy-MM-dd
 */
function getSimulatedTodayFromRequest(req) {
  if (!req || !req.headers) return null;
  if (req.user?.role !== 'ADMIN') return null;
  const raw = req.headers[SIMULATED_TODAY_HEADER];
  if (raw == null || raw === '') return null;
  const iso = String(Array.isArray(raw) ? raw[0] : raw)
    .trim()
    .slice(0, 10);
  return ISO_DAY_RE.test(iso) ? iso : null;
}

/**
 * Hoy del hotel: fecha simulada del request si viene el header, si no reloj local.
 * @param {import('express').Request|null|undefined} req
 * @returns {string} yyyy-MM-dd
 */
function todayIsoLocal(req) {
  return getSimulatedTodayFromRequest(req) || realTodayIsoLocal();
}

/**
 * “Ahora” en el día civil del hotel. Con simulación, conserva H:M:S del reloj
 * real sobre el día simulado (útil para timestamps de cobro/caja).
 * @param {import('express').Request|null|undefined} req
 * @returns {Date}
 */
function nowLocal(req) {
  const simulated = getSimulatedTodayFromRequest(req);
  if (!simulated) return new Date();
  const [y, m, d] = simulated.split('-').map(Number);
  const real = new Date();
  return new Date(
    y,
    m - 1,
    d,
    real.getHours(),
    real.getMinutes(),
    real.getSeconds(),
    real.getMilliseconds()
  );
}

/**
 * Interpreta fecha de negocio (body/query). YYYY-MM-DD → mediodía local.
 * Vacío/ inválido → nowLocal(req) (respeta fecha debug).
 * @param {unknown} raw
 * @param {import('express').Request|null|undefined} req
 * @returns {Date}
 */
function parseFechaInput(raw, req) {
  if (raw == null || raw === '') return nowLocal(req);
  const s = String(raw).trim();
  const dayOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayOnly) {
    return new Date(
      Number(dayOnly[1]),
      Number(dayOnly[2]) - 1,
      Number(dayOnly[3]),
      12,
      0,
      0,
      0
    );
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return nowLocal(req);
}

module.exports = {
  toDateOnlyUtc,
  isoDate,
  shiftIso,
  civilFromDb,
  daysBetweenCivil,
  SIMULATED_TODAY_HEADER,
  realTodayIsoLocal,
  getSimulatedTodayFromRequest,
  todayIsoLocal,
  nowLocal,
  parseFechaInput
};
