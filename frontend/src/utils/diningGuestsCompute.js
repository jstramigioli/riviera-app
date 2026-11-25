/**
 * Espejo liviano del cómputo backend para UI/tests.
 * Fuente de verdad operativa: GET /api/dining-reservations/agenda.
 * Las pantallas de Comedor deben consumir esa API; este módulo sirve
 * para validar reglas en tests sin duplicar lógica ad-hoc en componentes.
 */

function normalizeServiceToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function mealFlagsFromServiceRef(ref) {
  if (ref == null || ref === '') return { breakfast: false, dinner: false };
  const blob = normalizeServiceToken(ref);
  if (
    blob.includes('media_pension') ||
    blob.includes('half_board') ||
    blob === 'half' ||
    blob.includes('half')
  ) {
    return { breakfast: true, dinner: true };
  }
  if (
    blob.includes('solo_alojamiento') ||
    blob.includes('sin_desayuno') ||
    blob === 'lodging' ||
    blob === 'base' ||
    (blob.includes('alojamiento') &&
      !blob.includes('desayuno') &&
      !blob.includes('pension'))
  ) {
    return { breakfast: false, dinner: false };
  }
  if (
    blob.includes('desayuno') ||
    blob.includes('breakfast') ||
    blob.includes('con_desayuno')
  ) {
    return { breakfast: true, dinner: false };
  }
  return { breakfast: false, dinner: false };
}

/**
 * Agrega totales a partir de una respuesta de agenda (ya calculada en backend).
 * Útil para asserts de UI sin recalcular MP.
 */
export function sumAgendaTotals(agenda) {
  const t = agenda?.totals || {};
  return {
    mediaPension: Number(t.mediaPension) || 0,
    additional: Number(t.additional) || 0,
    external: Number(t.external) || 0,
    total: Number(t.total) || 0
  };
}
