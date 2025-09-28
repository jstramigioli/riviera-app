import { useState, useEffect } from 'react';
import { fetchRooms, fetchReservations, fetchClients, fetchQueries } from '../services/api.js';
import { sortRooms } from '../utils/roomUtils.js';

export function useAppData() {
  const [rooms, setRooms] = useState([]);
  const [clients, setClients] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchRooms(), fetchReservations(), fetchClients(), fetchQueries()])
      .then(([roomsData, reservationsData, clientsData, queriesData]) => {
        console.log('Rooms loaded:', roomsData.length);
        console.log('Reservations loaded:', reservationsData.length);
        console.log('Clients loaded:', clientsData.length);
        console.log('Queries loaded:', queriesData.length);
        console.log('Sample reservation:', reservationsData[0]);
        
        // Ordenar habitaciones usando la utilidad
        const roomsOrdenadas = sortRooms(roomsData);
        
        setRooms(roomsOrdenadas);
        setReservations(reservationsData);
        setClients(clientsData);
        setQueries(queriesData);
      })
      .catch(err => {
        console.error('Error loading data:', err);
        // Mejorar el mensaje de error para el usuario
        let userFriendlyError = err.message;
        if (err.message.includes('operational periods')) {
          userFriendlyError = 'Error fetching operational periods';
        } else if (err.message.includes('fetch')) {
          userFriendlyError = 'Error de conexión con el servidor';
        } else if (err.message.includes('500')) {
          userFriendlyError = 'Error interno del servidor';
        }
        setError(userFriendlyError);
      })
      .finally(() => setLoading(false));
  }, []);

  return {
    rooms,
    setRooms,
    clients,
    setClients,
    reservations,
    setReservations,
    queries,
    setQueries,
    loading,
    error
  };
} 