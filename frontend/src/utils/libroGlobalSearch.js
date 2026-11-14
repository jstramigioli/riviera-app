import { clientSearchHaystack } from './clientListQuery';
import { getStatusLabel } from './reservationStatusUtils';

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function dateLabel(value) {
  const key = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function personName(person) {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
}

function reservationHaystack(reservation) {
  const client = reservation?.mainClient || {};
  return normalize(
    [
      reservation?.id,
      personName(client),
      client.email,
      client.phone,
      client.documentNumber,
      reservation?.room?.name,
      reservation?.status,
      getStatusLabel(reservation?.status),
      reservation?.checkIn,
      reservation?.checkOut,
      reservation?.notes
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function queryHaystack(query) {
  const client = query?.mainClient || {};
  return normalize(
    [
      query?.id,
      personName(client),
      client.email,
      client.phone,
      client.documentNumber,
      query?.checkIn,
      query?.checkOut,
      query?.notes,
      query?.requiredGuests
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function matches(haystack, terms) {
  return terms.every((term) => haystack.includes(term));
}

/**
 * Buscador global del Libro: reservas, clientes y consultas.
 * @returns {{ type: 'reservation'|'client'|'query', id: string|number, title: string, subtitle: string, payload: object }[]}
 */
export function searchLibroEntities(
  { reservations = [], clients = [], queries = [] } = {},
  rawTerm = '',
  { limit = 12 } = {}
) {
  const term = normalize(rawTerm);
  if (!term) return [];

  const terms = term.split(/\s+/).filter(Boolean);
  const results = [];

  for (const reservation of reservations) {
    if (!matches(reservationHaystack(reservation), terms)) continue;
    const name = personName(reservation.mainClient) || 'Sin cliente';
    const dates = [dateLabel(reservation.checkIn), dateLabel(reservation.checkOut)]
      .filter(Boolean)
      .join(' → ');
    results.push({
      type: 'reservation',
      id: reservation.id,
      title: name,
      subtitle: [`Reserva #${reservation.id}`, getStatusLabel(reservation.status), dates]
        .filter(Boolean)
        .join(' · '),
      payload: reservation
    });
  }

  for (const client of clients) {
    if (!matches(normalize(clientSearchHaystack(client)), terms)) continue;
    const name = personName(client) || 'Cliente';
    const bits = [client.documentNumber, client.phone, client.email].filter(Boolean);
    results.push({
      type: 'client',
      id: client.id,
      title: name,
      subtitle: ['Cliente', ...bits].join(' · '),
      payload: client
    });
  }

  for (const query of queries) {
    if (!matches(queryHaystack(query), terms)) continue;
    const name = personName(query.mainClient) || 'Sin cliente';
    const dates = [dateLabel(query.checkIn), dateLabel(query.checkOut)]
      .filter(Boolean)
      .join(' → ');
    results.push({
      type: 'query',
      id: query.id,
      title: name,
      subtitle: [`Consulta #${query.id}`, dates].filter(Boolean).join(' · '),
      payload: query
    });
  }

  const typeRank = { reservation: 0, client: 1, query: 2 };
  results.sort((a, b) => {
    const byType = typeRank[a.type] - typeRank[b.type];
    if (byType !== 0) return byType;
    return String(a.title).localeCompare(String(b.title), 'es', { sensitivity: 'base' });
  });

  return results.slice(0, limit);
}

export const LIBRO_SEARCH_TYPE_LABEL = {
  reservation: 'Reserva',
  client: 'Cliente',
  query: 'Consulta'
};
