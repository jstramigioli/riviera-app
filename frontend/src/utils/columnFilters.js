/** Helpers para filtros por columna de tablas (texto, rangos y opciones). */

export function foldText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** «Contiene», sin distinguir mayúsculas ni acentos. */
export function matchesText(haystack, needle) {
  const n = foldText(needle).trim();
  return !n || foldText(haystack).includes(n);
}

/** value: fecha (YYYY-MM-DD, ISO o Date); range: { from, to } en YYYY-MM-DD. */
export function inDateRange(value, range) {
  if (!range?.from && !range?.to) return true;
  if (!value) return false;
  const iso =
    typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
  if (range.from && iso < range.from) return false;
  if (range.to && iso > range.to) return false;
  return true;
}

export function inNumberRange(value, range) {
  const min = range?.min === '' || range?.min == null ? null : Number(range.min);
  const max = range?.max === '' || range?.max == null ? null : Number(range.max);
  const n = Number(value) || 0;
  if (min != null && !Number.isNaN(min) && n < min) return false;
  if (max != null && !Number.isNaN(max) && n > max) return false;
  return true;
}

/** values: lo que tiene la fila (uno o varios); selected: opciones elegidas (vacío = todas). */
export function matchesOptions(values, selected) {
  if (!selected?.length) return true;
  const list = Array.isArray(values) ? values : [values];
  return list.some((v) => selected.includes(v));
}

export function isFilterActive(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value).some((v) => String(v ?? '').trim() !== '');
  }
  return String(value).trim() !== '';
}
