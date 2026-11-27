/** Preferencias alimentarias (Guest, check-in online y comensales de cenas). */
export const DIETAS = [
  { key: 'dietVegetariano', label: 'Vegetariano' },
  { key: 'dietVegano', label: 'Vegano' },
  { key: 'dietCeliaco', label: 'Celíaco' }
];

/** Etiquetas de las preferencias de una persona, incluida la «otra» en texto libre. */
export function dietasDe(persona) {
  const out = DIETAS.filter((d) => Boolean(persona?.[d.key])).map((d) => d.label);
  const otra = typeof persona?.dietOtra === 'string' ? persona.dietOtra.trim() : '';
  if (otra) out.push(otra.charAt(0).toUpperCase() + otra.slice(1));
  return out;
}
