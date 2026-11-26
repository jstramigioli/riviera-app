/**
 * Helpers de display para cobros single y multi-imputación.
 * Un cobro multi tiene reservaId/reserva null y N filas en imputaciones.
 */

function personName(person) {
  if (!person) return '';
  return `${person.firstName || ''} ${person.lastName || ''}`.trim();
}

export function pagoMoneda(cobro) {
  return String(cobro?.moneda || 'ARS').toUpperCase();
}

export function paymentCodeLabel(cobro) {
  return cobro?.codigo || (cobro?.id != null ? `Nº ${cobro.id}` : '—');
}

export function formatDisplayDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/** Cliente titular del cobro (reserva ancla, imputaciones o cuenta). */
export function cobroClient(cobro) {
  if (cobro?.reserva?.mainClient) return cobro.reserva.mainClient;

  const imputaciones = Array.isArray(cobro?.imputaciones) ? cobro.imputaciones : [];
  for (const imp of imputaciones) {
    const fromReserva = imp?.reserva?.mainClient || imp?.account?.reservation?.mainClient;
    if (fromReserva) return fromReserva;
    if (imp?.account?.client) return imp.account.client;
  }

  if (cobro?.account?.client) return cobro.account.client;
  return null;
}

export function cobroClientDisplayName(cobro) {
  const client = cobroClient(cobro);
  const name = personName(client);
  if (name) return name;

  const imputaciones = Array.isArray(cobro?.imputaciones) ? cobro.imputaciones : [];
  for (const imp of imputaciones) {
    if (imp?.account?.kind === 'EXTERNAL' && imp.account.label) {
      return String(imp.account.label).trim();
    }
  }
  if (cobro?.account?.kind === 'EXTERNAL' && cobro.account.label) {
    return String(cobro.account.label).trim();
  }
  return 'Sin cliente';
}

/**
 * Reservas vinculadas al cobro (ancla + imputaciones), únicas por id.
 * @returns {Array<{ id: number, source?: string|null, status?: string|null }>}
 */
export function cobroReservations(cobro) {
  const map = new Map();

  const push = (id, source = null, status = null) => {
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    if (map.has(n)) {
      const prev = map.get(n);
      map.set(n, {
        id: n,
        source: prev.source ?? source,
        status: prev.status ?? status
      });
      return;
    }
    map.set(n, { id: n, source: source ?? null, status: status ?? null });
  };

  if (cobro?.reserva?.id != null) {
    push(cobro.reserva.id, cobro.reserva.source, cobro.reserva.status);
  } else if (cobro?.reservaId != null) {
    push(cobro.reservaId);
  }

  for (const imp of Array.isArray(cobro?.imputaciones) ? cobro.imputaciones : []) {
    const reserva = imp?.reserva || imp?.account?.reservation || null;
    const id = reserva?.id ?? imp?.reservaId;
    if (id != null) push(id, reserva?.source, reserva?.status);
  }

  return Array.from(map.values());
}

export function cobroMatchesClientId(cobro, clientId) {
  const id = Number(clientId);
  if (!Number.isFinite(id)) return true;

  const client = cobroClient(cobro);
  if (client?.id != null && Number(client.id) === id) return true;
  if (Number(cobro?.reserva?.mainClientId) === id) return true;
  if (Number(cobro?.account?.clientId) === id) return true;

  for (const imp of Array.isArray(cobro?.imputaciones) ? cobro.imputaciones : []) {
    if (Number(imp?.reserva?.mainClient?.id) === id) return true;
    if (Number(imp?.account?.reservation?.mainClient?.id) === id) return true;
    if (Number(imp?.account?.clientId) === id) return true;
    if (Number(imp?.account?.client?.id) === id) return true;
  }
  return false;
}

export function cobroReservationSearchHaystack(cobro) {
  const parts = [];
  for (const r of cobroReservations(cobro)) {
    parts.push(String(r.id));
  }
  for (const imp of Array.isArray(cobro?.imputaciones) ? cobro.imputaciones : []) {
    if (imp?.account?.kind === 'EXTERNAL') {
      parts.push(imp.account.label || `ext-${imp.account.id}`);
    }
  }
  if (cobro?.account?.kind === 'EXTERNAL') {
    parts.push(cobro.account.label || `ext-${cobro.account.id}`);
  }
  return parts.join(' ');
}
