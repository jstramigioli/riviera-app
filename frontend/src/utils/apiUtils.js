import { fetchReservations, fetchClients, updateReservation, updateClient } from '../services/api.js';

// Función para actualizar reservas con actualización optimista
export async function updateReservationOnServer(reservationId, updateData, setReservations) {
  // Actualización optimista
  setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, ...updateData } : r));
  try {
    const updated = await updateReservation(reservationId, updateData);
    setReservations(prev => prev.map(r => r.id === reservationId ? updated : r));
    return updated;
  } catch (error) {
    alert('Error de conexión. Los cambios se han revertido.');
    // Revertir
    const reservations = await fetchReservations();
    setReservations(reservations);
    throw error;
  }
}

// Función para actualizar clientes con actualización optimista
export async function updateClientOnServer(clientId, updateData, setClients) {
  // Actualización optimista
  setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updateData } : c));
  try {
    const updated = await updateClient(clientId, updateData);
    setClients(prev => prev.map(c => c.id === clientId ? updated : c));
    return updated;
  } catch (error) {
    alert('Error de conexión. Los cambios se han revertido.');
    // Revertir
    const clients = await fetchClients();
    setClients(clients);
    throw error;
  }
} 