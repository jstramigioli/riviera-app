export const PAGE_SIZE_OPTIONS = [20, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;

export function normalizePageSize(value, fallback = DEFAULT_PAGE_SIZE) {
  const n = Number(value);
  if (PAGE_SIZE_OPTIONS.includes(n)) return n;
  return fallback;
}

export function totalPagesFor(count, pageSize) {
  const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  return Math.max(1, Math.ceil((Number(count) || 0) / size));
}

export function clampPage(page, totalPages) {
  const max = Math.max(1, Number(totalPages) || 1);
  const p = Number(page) || 1;
  return Math.min(Math.max(p, 1), max);
}

export function pageSlice(items, page, pageSize) {
  const list = Array.isArray(items) ? items : [];
  const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const totalPages = totalPagesFor(list.length, size);
  const safePage = clampPage(page, totalPages);
  const start = (safePage - 1) * size;
  return list.slice(start, start + size);
}

export function pageRange(total, page, pageSize) {
  const count = Number(total) || 0;
  if (count <= 0) return { from: 0, to: 0 };
  const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const totalPages = totalPagesFor(count, size);
  const safePage = clampPage(page, totalPages);
  const from = (safePage - 1) * size + 1;
  const to = Math.min(safePage * size, count);
  return { from, to };
}
