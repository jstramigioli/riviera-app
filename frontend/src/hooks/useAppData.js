import { useState, useEffect } from 'react';
import { fetchRooms, fetchReservations, fetchClients, fetchOperationalPeriods } from '../services/api.js';
import { sortRooms } from '../utils/roomUtils.js';

export function useAppData() {
  const [rooms, setRooms] = useState([]);
  const [clients, setClients] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [operationalPeriods, setOperationalPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchRooms(), fetchReservations(), fetchClients(), fetchOperationalPeriods()])
      .then(([roomsData, reservationsData, clientsData, periodsData]) => {
        console.log('Rooms loaded:', roomsData.length);
        console.log('Reservations loaded:', reservationsData.length);
        console.log('Clients loaded:', clientsData.length);
        console.log('Operational periods loaded:', periodsData.length);
        console.log('Sample reservation:', reservationsData[0]);
        
        // Ordenar habitaciones usando la utilidad
        const roomsOrdenadas = sortRooms(roomsData);
        
        setRooms(roomsOrdenadas);
        setReservations(reservationsData);
        setClients(clientsData);
        setOperationalPeriods(periodsData);
      })
      .catch(err => {
        console.error('Error loading data:', err);
        setError(err.message);
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
    operationalPeriods,
    setOperationalPeriods,
    loading,
    error
  };
} 