import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchReservations, fetchRooms } from '../services/api';
import { occupancyLabel } from '../utils/roomOccupancy';
import styles from './Habitaciones.module.css';

function Habitaciones() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [roomsData, reservationsData] = await Promise.all([
        fetchRooms(),
        fetchReservations(),
      ]);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
      setReservations(Array.isArray(reservationsData) ? reservationsData : []);
    } catch (err) {
      console.error('Error cargando habitaciones:', err);
      setError('Error al cargar las habitaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...rooms].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    if (!query) return sorted;
    return sorted.filter((room) => {
      const haystack = [
        room.name,
        room.roomType?.name,
        room.status,
        ...(room.tags || []).map((tag) => tag.name || tag),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rooms, search]);

  if (loading) {
    return <div className={styles.loading}>Cargando habitaciones...</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <div className={styles.error}>{error}</div>
        <button type="button" onClick={loadData} className={styles.retryButton}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.newLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Habitaciones</h2>
        </div>
        <nav className={styles.sectionMenu} aria-label="Secciones de habitaciones">
          <button type="button" className={`${styles.sectionButton} ${styles.active}`}>
            Listado
          </button>
        </nav>
      </aside>

      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Listado de habitaciones</h2>
              <label className={styles.searchField}>
                <span className={styles.srOnly}>Buscar habitación</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, tipo o etiqueta…"
                />
              </label>
            </div>

            {filteredRooms.length === 0 ? (
              <div className={styles.emptyState}>No hay habitaciones para mostrar</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Habitación</th>
                      <th>Tipo</th>
                      <th>Capacidad</th>
                      <th>Ocupación</th>
                      <th>Etiquetas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRooms.map((room) => {
                      const occupancy = occupancyLabel(room.id, reservations);
                      const tags = (room.tags || [])
                        .map((tag) => tag.name || tag)
                        .filter(Boolean)
                        .join(', ');
                      return (
                        <tr
                          key={room.id}
                          className={styles.row}
                          onClick={() => navigate(`/habitaciones/${room.id}`)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              navigate(`/habitaciones/${room.id}`);
                            }
                          }}
                          tabIndex={0}
                          role="link"
                        >
                          <td>{room.name}</td>
                          <td>{room.roomType?.name || 'Sin tipo'}</td>
                          <td>{room.maxPeople ?? '—'}</td>
                          <td>
                            <span
                              className={`${styles.occupancy} ${
                                occupancy === 'Ocupada' ? styles.occupied : styles.available
                              }`}
                            >
                              {occupancy}
                            </span>
                          </td>
                          <td>{tags || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default Habitaciones;
