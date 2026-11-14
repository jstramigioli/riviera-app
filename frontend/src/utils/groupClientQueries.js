/**
 * Agrupa filas Query del mismo queryGroupId en una entrada de listado.
 * Evita mostrar N tarjetas por una sola consulta multi-segmento.
 */
export function groupClientQueries(queries = []) {
  const grouped = {};
  const standalone = [];

  for (const query of queries) {
    if (query.queryGroupId) {
      if (!grouped[query.queryGroupId]) {
        grouped[query.queryGroupId] = [];
      }
      grouped[query.queryGroupId].push(query);
    } else {
      standalone.push(query);
    }
  }

  const fromGroups = Object.values(grouped).map((segments) => {
    const sorted = [...segments].sort(
      (a, b) => (a.segmentIndex || 0) - (b.segmentIndex || 0)
    );
    const latestUpdatedAt = segments.reduce((max, seg) => {
      const t = new Date(seg.updatedAt || 0).getTime();
      return t > max ? t : max;
    }, 0);

    return {
      ...sorted[0],
      id: sorted[0].id,
      queryGroupId: sorted[0].queryGroupId,
      checkIn: sorted[0].checkIn,
      checkOut: sorted[sorted.length - 1].checkOut,
      segmentCount: sorted.length,
      isMultiSegment: true,
      updatedAt: latestUpdatedAt
        ? new Date(latestUpdatedAt).toISOString()
        : sorted[0].updatedAt
    };
  });

  return [...standalone, ...fromGroups].sort((a, b) => {
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
}
