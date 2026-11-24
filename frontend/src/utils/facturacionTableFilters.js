/**
 * Filtros de las 3 tablas de Facturación (A/B/T).
 * Default: solo pendientes de comprobante (+ ids de sesión).
 */

function foldAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function isFacturacionPendingVisible(cobro, sessionDoneIds, adjuntosOf, adjuntoTipo) {
  const hasComprobante = adjuntosOf(cobro, adjuntoTipo).length > 0;
  if (!hasComprobante) return true;
  const idSet =
    sessionDoneIds instanceof Set
      ? sessionDoneIds
      : new Set(sessionDoneIds || []);
  return idSet.has(cobro?.id);
}

export function matchesFacturacionSearch(haystack, needle) {
  const n = foldAccents(String(needle || '').trim());
  if (!n) return true;
  return foldAccents(haystack).includes(n);
}

export function filterFacturacionRows({
  payments,
  tipo,
  showPrevious,
  search,
  sessionDoneIds,
  adjuntosOf,
  adjuntoTipo,
  searchHaystack,
  sortMs,
}) {
  const needle = String(search || '').trim();
  return (payments || [])
    .filter((cobro) => cobro?.requiereFacturacion && cobro?.factura?.tipo === tipo)
    .filter((cobro) =>
      showPrevious
        ? true
        : isFacturacionPendingVisible(cobro, sessionDoneIds, adjuntosOf, adjuntoTipo)
    )
    .filter((cobro) => matchesFacturacionSearch(searchHaystack(cobro), needle))
    .slice()
    .sort((a, b) => {
      const diff = sortMs(b) - sortMs(a);
      if (diff !== 0) return diff;
      return Number(b.id) - Number(a.id);
    });
}
