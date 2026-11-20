import { API_URL } from './api';

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.message || data.error || 'Error de autenticación';
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function loginRequest(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return parseJson(res);
}

export async function logoutRequest() {
  const res = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
  return parseJson(res);
}

export async function meRequest() {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'GET',
    credentials: 'include'
  });
  return parseJson(res);
}

export async function fetchUsers() {
  const res = await fetch(`${API_URL}/auth/users`, {
    method: 'GET',
    credentials: 'include'
  });
  return parseJson(res);
}

export async function fetchRoles() {
  const res = await fetch(`${API_URL}/auth/roles`, {
    method: 'GET',
    credentials: 'include'
  });
  return parseJson(res);
}

export async function createUserRequest(payload) {
  const res = await fetch(`${API_URL}/auth/users`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return parseJson(res);
}

export async function updateUserRequest(id, payload) {
  const res = await fetch(`${API_URL}/auth/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return parseJson(res);
}

export async function deleteUserRequest(id) {
  const res = await fetch(`${API_URL}/auth/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return parseJson(res);
}
