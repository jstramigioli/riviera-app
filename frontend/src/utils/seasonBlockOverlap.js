/**
 * Overlap de bloques de temporada por día civil YYYY-MM-DD.
 * Intervalo cerrado [start, end]: comparten al menos un día = overlap.
 * No es half-open.
 */

export function toCivilDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value.length >= 10) return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function rangesOverlapInclusive(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && endA >= startB;
}

/**
 * @param {string} startDate
 * @param {string} endDate
 * @param {Array} otherBlocks
 * @param {string|null} excludeId
 * @param {{ includeDrafts?: boolean }} options - por defecto solo bloques activos
 */
export function hasActiveSeasonOverlap(startDate, endDate, otherBlocks = [], excludeId = null, options = {}) {
  const { includeDrafts = false } = options;
  const start = toCivilDate(startDate);
  const end = toCivilDate(endDate);
  if (!start || !end) return false;

  return otherBlocks.some((otherBlock) => {
    if (excludeId && otherBlock.id === excludeId) return false;
    if (!includeDrafts && otherBlock.isDraft) return false;
    return rangesOverlapInclusive(
      start,
      end,
      toCivilDate(otherBlock.startDate),
      toCivilDate(otherBlock.endDate)
    );
  });
}
