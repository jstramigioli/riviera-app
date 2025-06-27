const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export { API_URL };

export async function fetchRooms() {
  const res = await fetch(`${API_URL}/rooms`);
  if (!res.ok) throw new Error('Error fetching rooms');
  return res.json();
}

export async function fetchReservations() {
  const res = await fetch(`${API_URL}/reservations`);
  if (!res.ok) throw new Error('Error fetching reservations');
  return res.json();
}

export async function fetchClients() {
  const res = await fetch(`${API_URL}/clients`);
  if (!res.ok) throw new Error('Error fetching clients');
  return res.json();
}

export async function fetchGuests() {
  const res = await fetch(`${API_URL}/guests`);
  if (!res.ok) throw new Error('Error fetching guests');
  return res.json();
}

export async function fetchPayments() {
  const res = await fetch(`${API_URL}/payments`);
  if (!res.ok) throw new Error('Error fetching payments');
  return res.json();
}

export async function fetchPaymentsByGuest(guestId) {
  const res = await fetch(`${API_URL}/payments/guest/${guestId}`);
  if (!res.ok) throw new Error('Error fetching guest payments');
  return res.json();
}

export async function updateReservation(id, data) {
  const res = await fetch(`${API_URL}/reservations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating reservation');
  return res.json();
}

export async function updateClient(id, data) {
  const res = await fetch(`${API_URL}/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating client');
  return res.json();
}

export async function updateGuest(id, data) {
  const res = await fetch(`${API_URL}/guests/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating guest');
  return res.json();
}

export async function getGuestBalance(guestId) {
  const res = await fetch(`${API_URL}/guests/${guestId}/balance`);
  if (!res.ok) throw new Error('Error fetching guest balance');
  return res.json();
}

export async function createPayment(data) {
  const res = await fetch(`${API_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating payment');
  return res.json();
}

export async function createConsumptionCharge(data) {
  const res = await fetch(`${API_URL}/payments/consumption-charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating consumption charge');
  return res.json();
}

export async function getClientBalance(clientId) {
  const res = await fetch(`${API_URL}/clients/${clientId}/balance`);
  if (!res.ok) throw new Error('Error fetching client balance');
  return res.json();
}