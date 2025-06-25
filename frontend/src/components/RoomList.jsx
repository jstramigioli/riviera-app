import { useEffect, useState } from 'react';
import { fetchRooms } from '../services/api';

export default function RoomList() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRooms()
      .then(data => setRooms(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando habitaciones...</p>;
  if (error) return <p style={{color: 'red'}}>Error: {error}</p>;

  return (
    <div>
      <h2>Habitaciones</h2>
      <ul>
        {rooms.map(room => (
          <li key={room.id}>
            <strong>{room.name}</strong> — Capacidad: {room.maxPeople} — Estado: {room.status}
            <br />
            Etiquetas: {room.tags.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}