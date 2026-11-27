/**
 * Preferencias alimentarias por huésped (PGH-372: viven en Guest, no en la reserva).
 * Resumen para cocina: «Celíaco ×1 · Vegetariano ×2».
 */
const DIETAS = [
  { key: 'dietCeliaco', label: 'Celíaco' },
  { key: 'dietVegano', label: 'Vegano' },
  { key: 'dietVegetariano', label: 'Vegetariano' }
];

/** Texto libre de «otra» preferencia, normalizado para agrupar («sin sal» = «Sin sal»). */
function dietaOtra(g) {
  const t = typeof g?.dietOtra === 'string' ? g.dietOtra.trim() : '';
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}

/** @param {Array<{dietCeliaco?: boolean, dietVegano?: boolean, dietVegetariano?: boolean, dietOtra?: string}>} guests */
function resumenDietas(guests) {
  const out = [];
  const list = (guests || []).filter(Boolean);
  for (const { key, label } of DIETAS) {
    const n = list.filter((g) => g[key]).length;
    if (n > 0) out.push(`${label} ×${n}`);
  }
  const otras = new Map();
  for (const g of list) {
    const t = dietaOtra(g);
    if (!t) continue;
    const k = t.toLowerCase();
    otras.set(k, { label: otras.get(k)?.label || t, n: (otras.get(k)?.n || 0) + 1 });
  }
  for (const { label, n } of otras.values()) out.push(`${label} ×${n}`);
  return out;
}

/** Personas con al menos una preferencia alimentaria. */
function contarConDieta(guests) {
  return (guests || []).filter(
    (g) => g && (DIETAS.some(({ key }) => g[key]) || dietaOtra(g))
  ).length;
}

const DIETA_GUEST_SELECT = { dietCeliaco: true, dietVegano: true, dietVegetariano: true, dietOtra: true };

module.exports = { resumenDietas, contarConDieta, dietaOtra, DIETA_GUEST_SELECT };
