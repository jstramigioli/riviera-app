/** Categorías del catálogo de platos del menú diario. */
const DISH_CATALOG_CATEGORIES = [
  'ENTRADA',
  'ENSALADA',
  'SOPA',
  'PLATO_PRINCIPAL',
  'PLATO_INFANTIL',
  'POSTRE',
  'BUFFET'
];

const VALID_DISH_CATEGORIES = new Set(DISH_CATALOG_CATEGORIES);

/**
 * Sección del menú diario → categoría de catálogo.
 * Primer y segundo plato comparten «plato principal».
 */
function sectionToDishCategory(section) {
  const s = String(section || '').toUpperCase();
  if (s === 'PRIMER_PLATO' || s === 'SEGUNDO_PLATO') return 'PLATO_PRINCIPAL';
  if (VALID_DISH_CATEGORIES.has(s)) return s;
  return null;
}

function isValidDishCategory(value) {
  return VALID_DISH_CATEGORIES.has(String(value || '').toUpperCase());
}

module.exports = {
  DISH_CATALOG_CATEGORIES,
  VALID_DISH_CATEGORIES,
  sectionToDishCategory,
  isValidDishCategory
};
