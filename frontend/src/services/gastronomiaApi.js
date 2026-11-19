import { API_URL } from './api';

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v != null && v !== '') sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function listDailyMenus({ from, to } = {}) {
  const res = await fetch(`${API_URL}/gastronomia/daily-menus${qs({ from, to })}`, {
    credentials: 'include'
  });
  return parseJson(res);
}

export async function getDailyMenu(id) {
  const res = await fetch(`${API_URL}/gastronomia/daily-menus/${id}`, {
    credentials: 'include'
  });
  return parseJson(res);
}

export async function getDailyMenuByDate(dateIso) {
  const res = await fetch(`${API_URL}/gastronomia/daily-menus/by-date/${dateIso}`, {
    credentials: 'include'
  });
  return parseJson(res);
}

export async function createDailyMenu(payload) {
  const res = await fetch(`${API_URL}/gastronomia/daily-menus`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return parseJson(res);
}

export async function updateDailyMenu(id, payload) {
  const res = await fetch(`${API_URL}/gastronomia/daily-menus/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return parseJson(res);
}

export async function patchDailyMenuStatus(id, status) {
  const res = await fetch(`${API_URL}/gastronomia/daily-menus/${id}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return parseJson(res);
}

export async function copyDailyMenu(id, targetDate) {
  const res = await fetch(`${API_URL}/gastronomia/daily-menus/${id}/copy`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetDate })
  });
  return parseJson(res);
}

export function dailyMenuPdfUrl(id) {
  return `${API_URL}/gastronomia/daily-menus/${id}/pdf`;
}

export async function fetchDailyMenuPdfBlob(id) {
  const res = await fetch(dailyMenuPdfUrl(id), { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.blob();
}

export async function searchDishes(q, limit = 20) {
  const res = await fetch(
    `${API_URL}/gastronomia/dishes${qs({ q, limit })}`,
    { credentials: 'include' }
  );
  return parseJson(res);
}

export async function renameDish(id, name) {
  const res = await fetch(`${API_URL}/gastronomia/dishes/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return parseJson(res);
}

export async function deleteDish(id) {
  const res = await fetch(`${API_URL}/gastronomia/dishes/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return parseJson(res);
}
