/**
 * Día civil canónico para el calendario (wire yyyy-MM-dd).
 * No usar toISOString() como identidad de día en UI/API de calendario.
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

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

module.exports = {
  toDateOnlyUtc,
  isoDate,
  shiftIso,
  civilFromDb,
  daysBetweenCivil
};
