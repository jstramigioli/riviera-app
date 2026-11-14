import { normalizeBedPreference } from './bedConfig';

/**
 * Fuente de huéspedes al hidratar una consulta:
 * multi-segmento → primer segmento; legacy → la query raíz.
 */
export function guestSourceFromQuery(query) {
  if (query?.isMultiSegment && Array.isArray(query.segments) && query.segments.length > 0) {
    return query.segments[0];
  }
  return query || {};
}

/**
 * Sync guests → filtros (requirements UI) al hidratar.
 * Sin esto, el select de huéspedes queda en el default (1) mientras
 * los segmentos / búsqueda de habitaciones usan el valor guardado (p.ej. 2).
 */
export function filtersFromLoadedGuests(source = {}) {
  const raw = Number(source.requiredGuests ?? source.guestCount);
  const requiredGuests = Number.isFinite(raw) && raw > 0 ? raw : 1;

  return {
    requiredGuests,
    requiredTags: Array.isArray(source.requiredTags) ? source.requiredTags : [],
    ...normalizeBedPreference(source),
    requiredRoomId: source.requiredRoomId || null,
    requirementsNotes: source.requirementsNotes || ''
  };
}
