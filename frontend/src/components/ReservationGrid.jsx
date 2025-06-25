import { useEffect, useState } from 'react';
import { fetchRooms, fetchReservations } from '../services/api';
import { addDays, format, isWithinInterval, parseISO } from 'date-fns';

function getDaysArray(start, end) {
  const arr = [];
  let dt = start;
  while (dt <= end) {
    arr.push(new Date(dt));
    dt = addDays(dt, 1);
  }
  return arr;
}

export default function ReservationGrid() {
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define el rango de días a mostrar (por ejemplo, los próximos 7 días)
  const today = new Date();
  const daysToShow = 30;
  const days = getDaysArray(today, addDays(today, daysToShow - 1));

  useEffect(() => {
    Promise.all([fetchRooms(), fetchReservations()])
      .then(([roomsData, reservationsData]) => {
        setRooms(roomsData);
        setReservations(reservationsData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando grilla de reservas...</p>;
  if (error) return <p style={{color: 'red'}}>Error: {error}</p>;

  // Helper para saber si una habitación está reservada en un día
  function getReservationFor(roomId, day) {
    return reservations.find(res =>
      res.roomId === roomId &&
      isWithinInterval(day, {
        start: parseISO(res.checkIn),
        end: parseISO(res.checkOut)
      })
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table border={1} cellPadding={4} style={{ borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr>
            <th>Habitación</th>
            {days.map(day => (
              <th key={day.toISOString()}>{format(day, 'dd/MM')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map(room => (
            <tr key={room.id}>
              <td><strong>{room.name}</strong></td>
              {days.map(day => {
                const res = getReservationFor(room.id, day);
                return (
                  <td key={day.toISOString()} style={{ background: res ? '#ffe0e0' : '#e0ffe0' }}>
                    {res ? (
                      <span>
                        {res.mainClient?.firstName} {res.mainClient?.lastName}
                        <br />
                        <small>({format(parseISO(res.checkIn), 'dd/MM')} - {format(parseISO(res.checkOut), 'dd/MM')})</small>
                      </span>
                    ) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}