import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchReservations, fetchRooms } from '../services/api';
import { getStatusLabel } from '../utils/reservationStatusUtils';
import {
  INACTIVE_ROOM_STATUSES,
  occupancyLabel,
  reservationTouchesRoom,
  stayBoundsForRoom,
} from '../utils/roomOccupancy';
import styles from './RoomDetails.module.css';

const TABS = [
  { id: 'overview', label: 'Resumen general' },
  { id: 'calendar', label: 'Calendario ocupación' },
  { id: 'reservations', label: 'Historial reservas' },
  { id: 'notes', label: 'Notificaciones / observaciones' },
];

function formatDate(dateValue) {
  if (!dateValue) return '—';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function RoomDetails() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');

  const loadRoomData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [roomsData, reservationsData] = await Promise.all([
        fetchRooms(),
        fetchReservations(),
      ]);

      const foundRoom = (roomsData || []).find((item) => item.id === parseInt(roomId, 10));
      if (!foundRoom) {
        throw new Error('Habitación no encontrada');
      }

      const roomReservations = (reservationsData || []).filter((reservation) =>
        reservationTouchesRoom(reservation, roomId)
      );

      setRoom(foundRoom);
      setReservations(roomReservations);
    } catch (err) {
      console.error('Error cargando datos de la habitación:', err);
      setError(err.message === 'Habitación no encontrada'
        ? 'Habitación no encontrada'
        : 'Error al cargar los datos de la habitación');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (roomId) loadRoomData();
  }, [roomId, loadRoomData]);

  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => {
      const aStart = stayBoundsForRoom(a, roomId).start?.getTime() || 0;
      const bStart = stayBoundsForRoom(b, roomId).start?.getTime() || 0;
      return bStart - aStart;
    });
  }, [reservations, roomId]);

  const upcomingReservations = useMemo(() => {
    const now = new Date();
    return sortedReservations
      .filter((reservation) => {
        if (INACTIVE_ROOM_STATUSES.has(reservation.status)) return false;
        const { start } = stayBoundsForRoom(reservation, roomId);
        return start && start > now;
      })
      .slice(0, 8);
  }, [sortedReservations, roomId]);

  const currentGuest = useMemo(() => {
    const now = new Date();
    const current = reservations.find((reservation) => {
      if (INACTIVE_ROOM_STATUSES.has(reservation.status)) return false;
      const { start, end } = stayBoundsForRoom(reservation, roomId);
      return start && end && now >= start && now < end;
    });
    return current?.mainClient || null;
  }, [reservations, roomId]);

  const currentStatus = useMemo(
    () => (room ? occupancyLabel(room.id, reservations) : '—'),
    [room, reservations]
  );

  if (loading) {
    return <div className={styles.loading}>Cargando datos de la habitación...</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <div className={styles.error}>{error}</div>
        <div className={styles.errorActions}>
          <button type="button" onClick={loadRoomData} className={styles.retryButton}>
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => navigate('/habitaciones')}
            className={styles.retryButton}
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  if (!room) return null;

  const tags = (room.tags || [])
    .map((tag) => tag.name || tag)
    .filter(Boolean)
    .join(', ');

  return (
    <div className={styles.newLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>{room.name}</h2>
          <div className={styles.roomMeta}>
            <span>{room.roomType?.name || 'Sin tipo'}</span>
            <span className={styles.statusChip}>{currentStatus}</span>
            {currentGuest ? (
              <span className={styles.guestChip}>
                {currentGuest.firstName} {currentGuest.lastName}
              </span>
            ) : null}
          </div>
        </div>

        <nav className={styles.sectionMenu} aria-label="Secciones del perfil de habitación">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.sectionButton} ${activeSection === tab.id ? styles.active : ''}`}
              onClick={() => setActiveSection(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => navigate('/habitaciones')}
          >
            ← Volver al listado
          </button>
        </div>
      </aside>

      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>
          {activeSection === 'overview' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Resumen general</h2>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.overviewGrid}>
                  <div className={styles.infoBlock}>
                    <h3>Información básica</h3>
                    <dl className={styles.infoList}>
                      <div className={styles.infoItem}>
                        <dt>Nombre</dt>
                        <dd>{room.name}</dd>
                      </div>
                      <div className={styles.infoItem}>
                        <dt>Tipo</dt>
                        <dd>{room.roomType?.name || 'Sin tipo'}</dd>
                      </div>
                      <div className={styles.infoItem}>
                        <dt>Capacidad</dt>
                        <dd>{room.maxPeople ?? 'No especificada'}</dd>
                      </div>
                      <div className={styles.infoItem}>
                        <dt>Etiquetas</dt>
                        <dd>{tags || '—'}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className={styles.infoBlock}>
                    <h3>Estado actual</h3>
                    <dl className={styles.infoList}>
                      <div className={styles.infoItem}>
                        <dt>Ocupación</dt>
                        <dd>{currentStatus}</dd>
                      </div>
                      <div className={styles.infoItem}>
                        <dt>Huésped actual</dt>
                        <dd>
                          {currentGuest
                            ? `${currentGuest.firstName} ${currentGuest.lastName}`
                            : '—'}
                        </dd>
                      </div>
                      <div className={styles.infoItem}>
                        <dt>Reservas totales</dt>
                        <dd>{reservations.length}</dd>
                      </div>
                      <div className={styles.infoItem}>
                        <dt>Próximas reservas</dt>
                        <dd>{upcomingReservations.length}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                {room.description ? (
                  <div className={styles.descriptionBlock}>
                    <h3>Descripción</h3>
                    <p>{room.description}</p>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {activeSection === 'calendar' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Calendario ocupación</h2>
              </div>
              <div className={styles.panelBody}>
                {upcomingReservations.length === 0 ? (
                  <div className={styles.emptyState}>
                    No hay reservas próximas para esta habitación
                  </div>
                ) : (
                  <ul className={styles.upcomingList}>
                    {upcomingReservations.map((reservation) => {
                      const { start, end } = stayBoundsForRoom(reservation, roomId);
                      return (
                        <li key={reservation.id} className={styles.upcomingItem}>
                          <div className={styles.upcomingDates}>
                            <strong>{formatDate(start)}</strong>
                            {' — '}
                            <strong>{formatDate(end)}</strong>
                          </div>
                          <div>
                            {reservation.mainClient?.firstName}{' '}
                            {reservation.mainClient?.lastName}
                          </div>
                          <div className={styles.upcomingStatus}>
                            {getStatusLabel(reservation.status)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          )}

          {activeSection === 'reservations' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Historial reservas</h2>
              </div>
              {sortedReservations.length === 0 ? (
                <div className={styles.emptyState}>
                  Esta habitación no tiene reservas registradas
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Huésped</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Estado</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedReservations.map((reservation) => {
                        const { start, end } = stayBoundsForRoom(reservation, roomId);
                        return (
                          <tr key={reservation.id}>
                            <td>#{reservation.id}</td>
                            <td>
                              {reservation.mainClient?.firstName}{' '}
                              {reservation.mainClient?.lastName}
                            </td>
                            <td>{formatDate(start)}</td>
                            <td>{formatDate(end)}</td>
                            <td>{getStatusLabel(reservation.status)}</td>
                            <td>
                              <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => navigate(`/reservations/${reservation.id}`)}
                              >
                                Ver
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeSection === 'notes' && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Notificaciones / observaciones</h2>
              </div>
              <div className={styles.panelBody}>
                {room.description ? (
                  <div className={styles.notesBlock}>
                    <h3>Observaciones</h3>
                    <p>{room.description}</p>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    Sin notificaciones ni observaciones registradas
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default RoomDetails;
