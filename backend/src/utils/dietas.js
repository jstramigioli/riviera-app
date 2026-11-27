/**
 * Preferencias alimentarias por huésped (PGH-372: viven en Guest, no en la reserva).
 * Resumen para cocina: «Celíaco ×1 · Vegetariano ×2».
 */
const DIETAS = [
  { key: 'dietCeliaco', label: 'Celíaco' },
  { key: 'dietVegano', label: 'Vegano' },
  { key: 'dietVegetariano', label: 'Vegetariano' }
];

/** @param {Array<{dietCeliaco?: boolean, dietVegano?: boolean, dietVegetariano?: boolean}>} guests */
function resumenDietas(guests) {
  const out = [];
  for (const { key, label } of DIETAS) {
    const n = (guests || []).filter((g) => g && g[key]).length;
    if (n > 0) out.push(`${label} ×${n}`);
  }
  return out;
}

const DIETA_GUEST_SELECT = { dietCeliaco: true, dietVegano: true, dietVegetariano: true };

module.exports = { resumenDietas, DIETA_GUEST_SELECT };
