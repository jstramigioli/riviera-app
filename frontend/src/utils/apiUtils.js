import { fetchReservations, fetchClients, updateReservation, updateClient, updateReservationStatus } from '../services/api.js';

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

// Función para actualizar solo el estado de una reserva
export async function updateReservationStatusOnServer(reservationId, newStatus, setReservations) {
  // Actualización optimista
  setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, status: newStatus } : r));
  try {
    const updated = await updateReservationStatus(reservationId, newStatus);
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
export async function updateClientOnServer(clientId, updateData, setClients, setReservations) {
  // Actualización optimista de clientes
  setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...updateData } : c));
  
  // Actualización optimista de reservas relacionadas
  if (setReservations) {
    setReservations(prev => prev.map(r => 
      r.mainClientId === clientId 
        ? { 
            ...r, 
            mainClient: { 
              ...r.mainClient, 
              ...updateData 
            } 
          }
        : r
    ));
  }
  
  try {
    const updated = await updateClient(clientId, updateData);
    
    // Actualizar cliente con datos del servidor
    setClients(prev => prev.map(c => c.id === clientId ? updated : c));
    
    // Actualizar reservas relacionadas con datos del servidor
    if (setReservations) {
      setReservations(prev => prev.map(r => 
        r.mainClientId === clientId 
          ? { 
              ...r, 
              mainClient: updated 
            }
          : r
      ));
    }
    
    return updated;
  } catch (error) {
    alert('Error de conexión. Los cambios se han revertido.');
    // Revertir
    const clients = await fetchClients();
    const reservations = await fetchReservations();
    setClients(clients);
    if (setReservations) {
      setReservations(reservations);
    }
    throw error;
  }
} 