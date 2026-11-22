import { API_URL, apiFetch } from './api';

async function parseJson(res, fallbackError) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || fallbackError);
  }
  return data;
}

export async function fetchNotifications(params = {}) {
  const qs = new URLSearchParams();
  if (params.resolved) qs.set('resolved', params.resolved);
  if (params.read) qs.set('read', params.read);
  if (params.type) qs.set('type', params.type);
  if (params.severity) qs.set('severity', params.severity);
  if (params.q) qs.set('q', params.q);
  if (params.limit) qs.set('limit', String(params.limit));
  const res = await apiFetch(`${API_URL}/notifications?${qs.toString()}`, {
    credentials: 'include'
  });
  return parseJson(res, 'Error al listar notificaciones');
}

export async function syncNotifications(dateIso) {
  const res = await apiFetch(`${API_URL}/notifications/sync`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dateIso ? { date: dateIso } : {})
  });
  return parseJson(res, 'Error al sincronizar notificaciones');
}

export async function markNotificationRead(id) {
  const res = await apiFetch(`${API_URL}/notifications/${id}/read`, {
    method: 'POST',
    credentials: 'include'
  });
  return parseJson(res, 'Error al marcar leída');
}

export async function markNotificationUnread(id) {
  const res = await apiFetch(`${API_URL}/notifications/${id}/read`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return parseJson(res, 'Error al marcar no leída');
}

export async function resolveNotification(id) {
  const res = await apiFetch(`${API_URL}/notifications/${id}/resolve`, {
    method: 'POST',
    credentials: 'include'
  });
  return parseJson(res, 'Error al resolver');
}

export async function unresolveNotification(id) {
  const res = await apiFetch(`${API_URL}/notifications/${id}/unresolve`, {
    method: 'POST',
    credentials: 'include'
  });
  return parseJson(res, 'Error al reabrir');
}
