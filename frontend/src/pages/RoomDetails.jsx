import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchRooms, fetchReservations } from '../services/api';
import { getStatusLabel, RESERVATION_STATUSES } from '../utils/reservationStatusUtils';
import styles from './RoomDetails.module.css';

const OCCUPYING_STATUSES = [
  RESERVATION_STATUSES.PENDIENTE,
  RESERVATION_STATUSES.CONFIRMADA,
  RESERVATION_STATUSES.INGRESADA
];

const RoomDetails = () => {
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
        fetchReservations()
      ]);

      const foundRoom = roomsData.find(r => r.id === parseInt(roomId));
      if (!foundRoom) {
        throw new Error('Habitación no encontrada');
      }
      
      // Filtrar reservas que involucren esta habitación (vía segmentos)
      const roomIdNum = parseInt(roomId, 10);
      const roomReservations = reservationsData.filter(r =>
        r.roomId === roomIdNum ||
        r.segments?.some(segment => segment.roomId === roomIdNum)
      );

      setRoom(foundRoom);
      setReservations(roomReservations);
    } catch (err) {
      console.error('Error cargando datos de la habitación:', err);
      setError('Error al cargar los datos de la habitación');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (roomId) {
      loadRoomData();
    }
  }, [roomId, loadRoomData]);

  const handleBackClick = () => {
    navigate('/libro-de-reservas');
  };

  // Funciones auxiliares
  const getCurrentStatus = () => {
    const now = new Date();
    const currentReservation = reservations.find(r => {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      return now >= checkIn && now <= checkOut && OCCUPYING_STATUSES.includes(r.status);
    });
    
    if (currentReservation) {
      return 'Ocupada';
    }
    
    // Verificar si hay reservas próximas
    const upcomingReservations = reservations.filter(r => {
      const checkIn = new Date(r.checkIn);
      return checkIn > now && OCCUPYING_STATUSES.includes(r.status);
    });
    
    if (upcomingReservations.length > 0) {
      const nextReservation = upcomingReservations.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn))[0];
      const daysUntilOccupied = Math.ceil((new Date(nextReservation.checkIn) - now) / (1000 * 60 * 60 * 24));
      
      if (daysUntilOccupied <= 1) {
        return 'Llega mañana';
      } else if (daysUntilOccupied <= 3) {
        return `Llega en ${daysUntilOccupied} días`;
      } else {
        return 'Disponible';
      }
    }
    
    return 'Disponible';
  };

  const getCurrentGuest = () => {
    const now = new Date();
    const currentReservation = reservations.find(r => {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      return now >= checkIn && now <= checkOut && OCCUPYING_STATUSES.includes(r.status);
    });
    
    return currentReservation?.mainClient || null;
  };

  const getUpcomingReservations = () => {
    const now = new Date();
    return reservations.filter(r => {
      const checkIn = new Date(r.checkIn);
      return checkIn > now && OCCUPYING_STATUSES.includes(r.status);
    }).sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn)).slice(0, 3);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={styles.newLayout}>
        <div className={styles.loadingContainer}>
          <div className={styles.loading}>Cargando datos de la habitación...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.newLayout}>
        <div className={styles.errorContainer}>
          <div className={styles.error}>{error}</div>
          <button onClick={loadRoomData} className={styles.retryButton}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className={styles.newLayout}>
        <div className={styles.errorContainer}>
          <div className={styles.error}>Habitación no encontrada</div>
          <button onClick={handleBackClick} className={styles.retryButton}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  const currentStatus = getCurrentStatus();
  const currentGuest = getCurrentGuest();
  const upcomingReservations = getUpcomingReservations();

  return (
    <div className={styles.newLayout}>
      {/* Side Panel Izquierdo */}
      <div className={styles.sidePanel}>
        {/* Header del side panel */}
        <div className={styles.sidePanelHeader}>
          <h2>Habitación #{room.number}</h2>
          <div className={styles.roomInfo}>
            <div className={styles.roomName}>
              {room.name}
            </div>
            <div className={styles.roomType}>
              {room.roomType?.name || 'Sin tipo'}
            </div>
            <div className={styles.roomStatus}>
              <span className={styles.statusValue}>
                {currentStatus}
              </span>
            </div>
            {currentGuest && (
              <div className={styles.currentGuest}>
                <span className={styles.guestValue}>
                  {currentGuest.firstName} {currentGuest.lastName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Contenido del side panel - Menú de pestañas */}
        <div className={styles.sidePanelContent}>
          <div className={styles.sectionMenu}>
            <button 
              className={`${styles.sectionButton} ${activeSection === 'overview' ? styles.active : ''}`}
              onClick={() => setActiveSection('overview')}
            >
              📋 Resumen General
            </button>
            <button 
              className={`${styles.sectionButton} ${activeSection === 'calendar' ? styles.active : ''}`}
              onClick={() => setActiveSection('calendar')}
            >
              📅 Calendario de Ocupación
            </button>
            <button 
              className={`${styles.sectionButton} ${activeSection === 'maintenance' ? styles.active : ''}`}
              onClick={() => setActiveSection('maintenance')}
            >
              🧹 Estado de Limpieza
            </button>
            <button 
              className={`${styles.sectionButton} ${activeSection === 'reservations' ? styles.active : ''}`}
              onClick={() => setActiveSection('reservations')}
            >
              📝 Historial de Reservas
            </button>
            <button 
              className={`${styles.sectionButton} ${activeSection === 'notes' ? styles.active : ''}`}
              onClick={() => setActiveSection('notes')}
            >
              📄 Notas y Observaciones
            </button>
          </div>
        </div>

        {/* Footer con botones de acción */}
        <div className={styles.sidePanelFooter}>
          <div className={styles.actionButtons}>
            <button 
              className={styles.backButton}
              onClick={handleBackClick}
            >
              ← Volver a Reservas
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Derecho */}
      <div className={styles.mainContent}>
        {/* Contenido principal */}
        <div className={styles.mainContentBody}>
          {/* Sección de Resumen General */}
          {activeSection === 'overview' && (
            <div className={styles.section}>
              <h2>Resumen General</h2>
              <div className={styles.overviewContainer}>
                <div className={styles.overviewGrid}>
                  <div className={styles.overviewCard}>
                    <h3>Información Básica</h3>
                    <div className={styles.infoList}>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>Número:</span>
                        <span className={styles.value}>{room.number}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>Nombre:</span>
                        <span className={styles.value}>{room.name}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>Tipo:</span>
                        <span className={styles.value}>{room.roomType?.name || 'Sin tipo'}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>Capacidad:</span>
                        <span className={styles.value}>{room.capacity || 'No especificada'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.overviewCard}>
                    <h3>Estado Actual</h3>
                    <div className={styles.infoList}>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>Estado:</span>
                        <span className={styles.value}>{currentStatus}</span>
                      </div>
                      {currentGuest && (
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Huésped actual:</span>
                          <span className={styles.value}>
                            {currentGuest.firstName} {currentGuest.lastName}
                          </span>
                        </div>
                      )}
                      <div className={styles.infoItem}>
                        <span className={styles.label}>Reservas totales:</span>
                        <span className={styles.value}>{reservations.length}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>Próximas reservas:</span>
                        <span className={styles.value}>{upcomingReservations.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección de Calendario de Ocupación */}
          {activeSection === 'calendar' && (
            <div className={styles.section}>
              <h2>Calendario de Ocupación</h2>
              <div className={styles.calendarContainer}>
                <div className={styles.calendarInfo}>
                  <h3>Próximas Reservas</h3>
                  {upcomingReservations.length === 0 ? (
                    <div className={styles.noDataMessage}>
                      No hay reservas próximas para esta habitación
                    </div>
                  ) : (
                    <div className={styles.upcomingList}>
                      {upcomingReservations.map(reservation => (
                        <div key={reservation.id} className={styles.upcomingItem}>
                          <div className={styles.upcomingDates}>
                            <strong>{formatDate(reservation.checkIn)}</strong> - <strong>{formatDate(reservation.checkOut)}</strong>
                          </div>
                          <div className={styles.upcomingGuest}>
                            {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
                          </div>
                          <div className={styles.upcomingStatus}>
                            <span className={`${styles.statusBadge} ${styles[reservation.status]}`}>
                              {getStatusLabel(reservation.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sección de Estado de Limpieza */}
          {activeSection === 'maintenance' && (
            <div className={styles.section}>
              <h2>Estado de Limpieza y Mantenimiento</h2>
              <div className={styles.maintenanceContainer}>
                <div className={styles.maintenanceGrid}>
                  <div className={styles.maintenanceCard}>
                    <h3>Estado de Limpieza</h3>
                    <div className={styles.cleaningStatus}>
                      <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>Limpieza general:</span>
                        <span className={`${styles.statusIndicator} ${styles.clean}`}>✓ Limpia</span>
                      </div>
                      <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>Baño:</span>
                        <span className={`${styles.statusIndicator} ${styles.clean}`}>✓ Limpio</span>
                      </div>
                      <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>Ropa de cama:</span>
                        <span className={`${styles.statusIndicator} ${styles.needsCleaning}`}>⚠ Cambio pendiente</span>
                      </div>
                      <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>Toallas:</span>
                        <span className={`${styles.statusIndicator} ${styles.clean}`}>✓ Limpias</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.maintenanceCard}>
                    <h3>Mantenimiento</h3>
                    <div className={styles.maintenanceStatus}>
                      <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>Aire acondicionado:</span>
                        <span className={`${styles.statusIndicator} ${styles.working}`}>✓ Funcionando</span>
                      </div>
                      <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>Televisión:</span>
                        <span className={`${styles.statusIndicator} ${styles.working}`}>✓ Funcionando</span>
                      </div>
                      <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>WiFi:</span>
                        <span className={`${styles.statusIndicator} ${styles.working}`}>✓ Funcionando</span>
                      </div>
                      <div className={styles.statusItem}>
                        <span className={styles.statusLabel}>Iluminación:</span>
                        <span className={`${styles.statusIndicator} ${styles.needsRepair}`}>⚠ Revisar</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección de Historial de Reservas */}
          {activeSection === 'reservations' && (
            <div className={styles.section}>
              <h2>Historial de Reservas</h2>
              {reservations.length === 0 ? (
                <div className={styles.noDataMessage}>
                  Esta habitación no tiene reservas registradas
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.reservationsTable}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Huésped</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Estado</th>
                        <th>Total</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map(reservation => (
                        <tr 
                          key={reservation.id} 
                          className={styles.reservationRow}
                          onClick={() => navigate(`/reservations/${reservation.id}`)}
                        >
                          <td>#{reservation.id}</td>
                          <td>{reservation.mainClient?.firstName} {reservation.mainClient?.lastName}</td>
                          <td>{formatDate(reservation.checkIn)}</td>
                          <td>{formatDate(reservation.checkOut)}</td>
                          <td>
                            <span className={`${styles.statusValue} ${styles[reservation.status]}`}>
                              {getStatusLabel(reservation.status)}
                            </span>
                          </td>
                          <td className={styles.totalAmount}>
                            {formatPrice(reservation.totalAmount || 0)}
                          </td>
                          <td>
                            <button 
                              className={styles.viewButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/reservations/${reservation.id}`);
                              }}
                            >
                              Ver Detalles
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sección de Notas y Observaciones */}
          {activeSection === 'notes' && (
            <div className={styles.section}>
              <h2>Notas y Observaciones</h2>
              <div className={styles.notesContainer}>
                <div className={styles.notesCard}>
                  <h3>Notas Generales</h3>
                  <div className={styles.notesContent}>
                    <p>Esta habitación tiene una excelente vista al jardín y es muy silenciosa durante la noche.</p>
                    <p>El aire acondicionado funciona mejor en el modo automático.</p>
                    <p>La cama king size es muy cómoda según feedback de huéspedes.</p>
                  </div>
                </div>
                
                <div className={styles.notesCard}>
                  <h3>Observaciones de Mantenimiento</h3>
                  <div className={styles.notesContent}>
                    <p>Última limpieza profunda: 15/01/2024</p>
                    <p>Revisión de aire acondicionado: 10/01/2024</p>
                    <p>Cambio de cortinas: Pendiente</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomDetails;

