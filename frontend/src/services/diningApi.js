import { API_URL, apiFetch } from './api';

function errorMessage(body, fallback) {
  const raw = body && typeof body === 'object' ? body : {};
  return raw.error || raw.message || fallback;
}

async function parseJson(res, fallback) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(errorMessage(body, fallback));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Agenda del día: totales MP / adicionales / externos + listados. */
export async function fetchDiningAgenda(dateIso, serviceType = 'CENA') {
  const params = new URLSearchParams({
    date: dateIso,
    serviceType
  });
  const res = await apiFetch(`${API_URL}/dining-reservations/agenda?${params}`, {
    credentials: 'include'
  });
  return parseJson(res, 'Error al cargar agenda de comedor');
}

export async function listDiningReservations(filters = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.set('date', filters.date);
  if (filters.reservationId != null) params.set('reservationId', String(filters.reservationId));
  if (filters.clientId != null) params.set('clientId', String(filters.clientId));
  if (filters.status) params.set('status', filters.status);
  if (filters.serviceType) params.set('serviceType', filters.serviceType);
  const qs = params.toString();
  const res = await apiFetch(
    `${API_URL}/dining-reservations${qs ? `?${qs}` : ''}`,
    { credentials: 'include' }
  );
  return parseJson(res, 'Error al listar reservas de comedor');
}

export async function getDiningReservation(id) {
  const res = await apiFetch(`${API_URL}/dining-reservations/${id}`, {
    credentials: 'include'
  });
  return parseJson(res, 'Error al obtener reserva de comedor');
}

export async function createDiningReservation(data) {
  const res = await apiFetch(`${API_URL}/dining-reservations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseJson(res, 'Error al crear reserva de comedor');
}

export async function updateDiningReservation(id, data) {
  const res = await apiFetch(`${API_URL}/dining-reservations/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseJson(res, 'Error al actualizar reserva de comedor');
}

export async function cancelDiningReservation(id) {
  const res = await apiFetch(`${API_URL}/dining-reservations/${id}/cancel`, {
    method: 'POST',
    credentials: 'include'
  });
  return parseJson(res, 'Error al cancelar reserva de comedor');
}
