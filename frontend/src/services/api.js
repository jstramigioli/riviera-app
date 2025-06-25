const API_URL = 'http://localhost:3001/api';

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