import { API_URL } from './api';

async function parseJson(res, fallback) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || fallback);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchFakeReservationsMeta() {
  const res = await fetch(`${API_URL}/debug/fake-reservations/meta`, {
    credentials: 'include'
  });
  return parseJson(res, 'Debug no disponible');
}

export async function previewFakeReservations(body) {
  const res = await fetch(`${API_URL}/debug/fake-reservations/preview`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return parseJson(res, 'Error en preview');
}

export async function generateFakeReservations(body) {
  const res = await fetch(`${API_URL}/debug/fake-reservations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return parseJson(res, 'Error al generar');
}

export async function deleteFakeReservationBatch(batchId) {
  const res = await fetch(
    `${API_URL}/debug/fake-reservations/${encodeURIComponent(batchId)}`,
    { method: 'DELETE', credentials: 'include' }
  );
  return parseJson(res, 'Error al limpiar lote');
}

export async function deleteAllFakeReservations() {
  const res = await fetch(`${API_URL}/debug/fake-reservations`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return parseJson(res, 'Error al limpiar DEBUG');
}
