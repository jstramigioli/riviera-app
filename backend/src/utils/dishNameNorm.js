/**
 * Normaliza nombre de plato para búsqueda / anti-duplicados:
 * trim, NFD, quita marcas diacríticas, lower-case, colapsa espacios.
 */
function normalizeDishName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { normalizeDishName };
