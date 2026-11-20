/**
 * Día civil canónico (wire yyyy-MM-dd). Nunca usar toISOString() como key de día.
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** localStorage: fecha simulada de debug (yyyy-MM-dd) o ausente = reloj real. */
export const SIMULATED_TODAY_STORAGE_KEY = 'riviera.debug.simulatedToday';
export const SIMULATED_TODAY_EVENT = 'riviera:simulated-today';

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

/** Reloj real del navegador (ignora simulación). */
export function realTodayIsoLocal() {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

export function getSimulatedTodayIso() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SIMULATED_TODAY_STORAGE_KEY);
    if (raw && ISO_DAY_RE.test(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function isSimulatedTodayActive() {
  return Boolean(getSimulatedTodayIso());
}

function emitSimulatedTodayChange() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(SIMULATED_TODAY_EVENT, { detail: getSimulatedTodayIso() })
    );
  } catch {
    /* ignore (p.ej. entornos sin CustomEvent completo) */
  }
}

/** null/'' → desactiva y vuelve a fecha real. */
export function setSimulatedTodayIso(isoOrNull) {
  try {
    if (typeof localStorage === 'undefined') return getSimulatedTodayIso();
    if (!isoOrNull || !ISO_DAY_RE.test(String(isoOrNull).slice(0, 10))) {
      localStorage.removeItem(SIMULATED_TODAY_STORAGE_KEY);
    } else {
      localStorage.setItem(SIMULATED_TODAY_STORAGE_KEY, String(isoOrNull).slice(0, 10));
    }
  } catch {
    /* ignore */
  }
  emitSimulatedTodayChange();
  return getSimulatedTodayIso();
}

export function clearSimulatedToday() {
  return setSimulatedTodayIso(null);
}

/**
 * Hoy del hotel para UI/flujos: fecha simulada si está activa, si no reloj local.
 */
export function todayIsoLocal() {
  return getSimulatedTodayIso() || realTodayIsoLocal();
}

/**
 * Date “ahora” en el día civil del hotel (simulado o real).
 * Con simulación, conserva H:M:S del reloj real sobre el día simulado.
 */
export function todayAsLocalDate() {
  const iso = todayIsoLocal();
  const [y, m, d] = iso.split('-').map(Number);
  const real = new Date();
  if (!getSimulatedTodayIso()) return real;
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

/** Header que el FE envía al backend cuando hay fecha simulada. */
export const SIMULATED_TODAY_HEADER = 'X-Simulated-Today';

/** Suscripción a cambios de simulación (misma pestaña + storage). */
export function subscribeSimulatedToday(onChange) {
  if (typeof window === 'undefined') return () => {};
  const notify = () => onChange(getSimulatedTodayIso());
  const onCustom = () => notify();
  const onStorage = (e) => {
    if (e.key === SIMULATED_TODAY_STORAGE_KEY || e.key === null) notify();
  };
  window.addEventListener(SIMULATED_TODAY_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SIMULATED_TODAY_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
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
