/**
 * Día civil canónico (wire yyyy-MM-dd). Nunca usar toISOString() como key de día.
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toDateOnlyUtc(input) {
  if (typeof input === 'string') {
    const iso = input.length >= 10 ? input.slice(0, 10) : input;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

export function isoDate(input) {
  const d = toDateOnlyUtc(input);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Hoy local del navegador como yyyy-MM-dd (hotel "hoy"). */
export function todayIsoLocal() {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

export function shiftIso(iso, days) {
  const d = toDateOnlyUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function daysBetween(aIso, bIso) {
  const ms = toDateOnlyUtc(bIso).getTime() - toDateOnlyUtc(aIso).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** UI: DD/MM/AAAA */
export function formatDateUi(input) {
  const d = toDateOnlyUtc(typeof input === 'string' ? input.slice(0, 10) : input);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
