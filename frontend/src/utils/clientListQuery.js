import { getAddressFromNotes } from './clientAddressNotes';

export function clientSearchHaystack(client) {
  const address = getAddressFromNotes(client?.notes);
  return [
    client?.firstName,
    client?.lastName,
    client?.email,
    client?.phone,
    client?.documentType,
    client?.documentNumber,
    client?.birthDate,
    client?.country,
    client?.province,
    client?.city,
    address,
    client?.vehiclePlate,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function matchesClientFilters(client, { search = '', country = '', promotions = '', hasEmail = '' } = {}) {
  const query = String(search).trim().toLowerCase();
  if (query && !clientSearchHaystack(client).includes(query)) {
    return false;
  }

  if (country && (client?.country || '') !== country) {
    return false;
  }

  if (promotions === 'yes' && !client?.wantsPromotions) return false;
  if (promotions === 'no' && client?.wantsPromotions) return false;

  if (hasEmail === 'yes' && !client?.email) return false;
  if (hasEmail === 'no' && client?.email) return false;

  return true;
}

function sortValue(client, field) {
  if (field === 'address') {
    return getAddressFromNotes(client?.notes);
  }
  if (field === 'wantsPromotions') {
    return client?.wantsPromotions ? '1' : '0';
  }
  return client?.[field] ?? '';
}

export function sortClients(clients, sortField = 'lastName', sortDirection = 'asc') {
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...clients].sort((a, b) => {
    const aValue = String(sortValue(a, sortField)).toLowerCase();
    const bValue = String(sortValue(b, sortField)).toLowerCase();
    return aValue.localeCompare(bValue, 'es', { sensitivity: 'base', numeric: true }) * direction;
  });
}

export function filterAndSortClients(clients, options = {}) {
  const {
    search = '',
    country = '',
    promotions = '',
    hasEmail = '',
    sortField = 'lastName',
    sortDirection = 'asc',
  } = options;

  const filtered = (clients || []).filter((client) =>
    matchesClientFilters(client, { search, country, promotions, hasEmail })
  );
  return sortClients(filtered, sortField, sortDirection);
}

export function uniqueCountries(clients) {
  const set = new Set();
  (clients || []).forEach((client) => {
    if (client?.country) set.add(client.country);
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}
