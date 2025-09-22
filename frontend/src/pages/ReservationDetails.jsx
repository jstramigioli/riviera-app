import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fetchReservations, fetchRooms, getReservationPricingDetails, API_URL } from '../services/api.js';
import { getStatusLabel } from '../utils/reservationStatusUtils';
import { updateReservationOnServer } from '../utils/apiUtils';
import { validateReservationDates, validateReservationConflict, showConflictNotification } from '../utils/reservationUtils';
import ReservationStatusButtons from '../components/ReservationStatusButtons';
import EditPanel from '../components/EditPanel';
import ReservationPricingDetails from '../components/ReservationPricingDetails';
import SidePanel from '../components/SidePanel';
import { FaPen, FaTimes, FaSave, FaUser, FaCalendarAlt, FaBed, FaDollarSign, FaStickyNote, FaTable, FaTrash } from 'react-icons/fa';
import styles from './ReservationDetails.module.css';

const ReservationDetails = () => {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [pricingDetails, setPricingDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showPricingTable, setShowPricingTable] = useState(false);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const loadReservationData = async () => {
      try {
        setLoading(true);
        
        // Cargar datos necesarios
        const [reservationsData, roomsData] = await Promise.all([
          fetchReservations(),
          fetchRooms()
        ]);
        
        // Buscar la reserva específica
        const foundReservation = reservationsData.find(r => r.id === parseInt(reservationId));
        
        if (!foundReservation) {
          setError('Reserva no encontrada');
          setLoading(false);
          return;
        }
        
        setReservation(foundReservation);
        setEditData(foundReservation);
        setRooms(roomsData);
        
        // Cargar detalles de precios si están disponibles
        try {
          const pricing = await getReservationPricingDetails(parseInt(reservationId));
          setPricingDetails(pricing);
        } catch (error) {
          console.warn('No se pudieron cargar los detalles de precios:', error);
          setPricingDetails(null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error cargando datos de la reserva:', error);
        setError('Error al cargar los datos de la reserva');
        setLoading(false);
      }
    };

    if (reservationId) {
      loadReservationData();
    }
  }, [reservationId]);

  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const getServiceTypeLabel = (serviceType) => {
    const serviceMap = {
      'con_desayuno': 'Con Desayuno',
      'sin_desayuno': 'Sin Desayuno',
      'media_pension': 'Media Pensión',
      'pension_completa': 'Pensión Completa'
    };
    return serviceMap[serviceType] || serviceType;
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  const handleClientClick = () => {
    if (reservation?.mainClient?.id) {
      navigate(`/clients/${reservation.mainClient.id}`);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancelar edición - restaurar datos originales
      setEditData(reservation);
    }
    setIsEditing(!isEditing);
  };

  const handleEditChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditSave = async () => {
    try {
      // Validar fechas primero
      const dateValidation = validateReservationDates(editData.checkIn, editData.checkOut);
      if (!dateValidation.isValid) {
        alert(`Error de validación: ${dateValidation.message}`);
        return;
      }
      
      // Validar conflictos de reserva
      const conflict = validateReservationConflict(
        [reservation], // Solo comparar con la reserva actual
        editData.roomId,
        editData.checkIn,
        editData.checkOut,
        editData.id
      );
      
      if (conflict.hasConflict) {
        showConflictNotification(conflict.message);
        return;
      }
      
      const updated = await updateReservationOnServer(editData.id, editData, setReservation);
      setReservation(updated);
      setEditData(updated);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar los cambios');
    }
  };

  const handleStatusChange = async (reservationId, newStatus, actionType) => {
    // Aquí puedes implementar la lógica para cambiar el estado
    console.log('Status change:', reservationId, newStatus, actionType);
  };

  const handleDeleteReservation = async () => {
    try {
      const response = await fetch(`${API_URL}/reservations/${reservationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar la reserva');
      }

      // Redirigir a la página anterior después de eliminar
      navigate(-1);
    } catch (error) {
      console.error('Error eliminando reserva:', error);
      alert('Error al eliminar la reserva. Por favor, inténtalo de nuevo.');
    }
  };

  const handleCancelReservation = async () => {
    try {
      const response = await fetch(`${API_URL}/reservations/${reservationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelada' }),
      });

      if (!response.ok) {
        throw new Error('Error al cancelar la reserva');
      }

      const updatedReservation = await response.json();
      setReservation(updatedReservation);
      setShowDeleteModal(false);
      
      alert('Reserva cancelada exitosamente');
    } catch (error) {
      console.error('Error cancelando reserva:', error);
      alert('Error al cancelar la reserva. Por favor, inténtalo de nuevo.');
    }
  };

  const handleShowDeleteModal = () => {
    setShowDeleteModal(true);
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando detalles de la reserva...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleBackClick} className={styles.backButton}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Reserva no encontrada</h2>
          <p>La reserva con ID {reservationId} no existe.</p>
          <button onClick={handleBackClick} className={styles.backButton}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.newLayout}>
      {/* Side Panel Izquierdo */}
      <div className={styles.sidePanel}>
        {/* Header del side panel */}
        <div className={styles.sidePanelHeader}>
          <h2>Reserva #{reservation.id}</h2>
          <div className={styles.guestInfo}>
            <div className={styles.guestName}>
              {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
            </div>
            <div className={styles.guestDates}>
              {formatDate(reservation.checkIn)} / {formatDate(reservation.checkOut)}
            </div>
            <div className={styles.guestStatus}>
              <span className={`${styles.statusValue} ${styles[reservation.status]}`}>
                {getStatusLabel(reservation.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Contenido del side panel - Menú de pestañas */}
        <div className={styles.sidePanelContent}>
          <div className={styles.sectionMenu}>
            <button 
              className={`${styles.sectionButton} ${styles.active}`}
            >
              📋 Información General
            </button>
            <button 
              className={styles.sectionButton}
            >
              💰 Tarifas y Precios
            </button>
            <button 
              className={styles.sectionButton}
            >
              🏨 Detalles de Habitación
            </button>
            <button 
              className={styles.sectionButton}
            >
              📝 Notas y Comentarios
            </button>
          </div>
        </div>

        {/* Footer con botones de acción */}
        <div className={styles.sidePanelFooter}>
          <div className={styles.actionButtons}>
            <button 
              onClick={handleEditToggle} 
              className={`${styles.editButton} ${isEditing ? styles.editing : ''}`}
              title={isEditing ? 'Cancelar edición' : 'Editar reserva'}
            >
              {isEditing ? <FaTimes /> : <FaPen />}
              {isEditing ? 'Cancelar' : 'Editar'}
            </button>
            <button 
              onClick={handleShowDeleteModal}
              className={styles.deleteButton}
              title="Eliminar reserva"
            >
              <FaTrash />
              Eliminar
            </button>
            <button 
              onClick={handleBackClick}
              className={styles.backButton}
            >
              ← Volver
            </button>
          </div>
          <div className={styles.statusButtons}>
            <ReservationStatusButtons 
              reservation={reservation} 
              onStatusChange={handleStatusChange} 
            />
          </div>
        </div>
      </div>

      {/* Main Content Derecho */}
      <div className={styles.mainContent}>
        {/* Contenido principal */}
        <div className={styles.mainContentBody}>
          {/* Sección de Información General */}
          <div className={styles.section}>
            <h2>Información General</h2>
            
            {/* Información del cliente */}
            <div className={styles.infoCard}>
              <h3>Cliente Principal</h3>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem} onClick={handleClientClick} style={{ cursor: reservation.mainClient?.id ? 'pointer' : 'default' }}>
                  <span className={styles.label}>Nombre:</span>
                  <span className={styles.value}>
                    {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
                  </span>
                </div>
                {reservation.mainClient?.email && (
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Email:</span>
                    <span className={styles.value}>{reservation.mainClient.email}</span>
                  </div>
                )}
                {reservation.mainClient?.phone && (
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Teléfono:</span>
                    <span className={styles.value}>{reservation.mainClient.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Fechas de estancia */}
            <div className={styles.infoCard}>
              <h3>Fechas de Estancia</h3>
              <div className={styles.infoGrid}>
                {isEditing ? (
                  <>
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Fecha de Entrada:</span>
                      <input
                        type="date"
                        value={editData?.checkIn ? format(new Date(editData.checkIn), 'yyyy-MM-dd') : ''}
                        onChange={(e) => handleEditChange('checkIn', e.target.value)}
                        className={styles.editInput}
                      />
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Fecha de Salida:</span>
                      <input
                        type="date"
                        value={editData?.checkOut ? format(new Date(editData.checkOut), 'yyyy-MM-dd') : ''}
                        onChange={(e) => handleEditChange('checkOut', e.target.value)}
                        className={styles.editInput}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Check-in:</span>
                      <span className={styles.value}>{formatDate(reservation.checkIn)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Check-out:</span>
                      <span className={styles.value}>{formatDate(reservation.checkOut)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Noches:</span>
                      <span className={styles.value}>
                        {Math.ceil((new Date(reservation.checkOut) - new Date(reservation.checkIn)) / (1000 * 60 * 60 * 24))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Requerimientos */}
            {reservation.segments && reservation.segments.length > 0 && (
              <div className={styles.infoCard}>
                <h3>Requerimientos</h3>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Huéspedes:</span>
                    <span className={styles.value}>
                      {reservation.segments[0].guestCount || reservation.requiredGuests || 1} persona{(reservation.segments[0].guestCount || reservation.requiredGuests || 1) > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Servicio:</span>
                    <span className={styles.value}>
                      {getServiceTypeLabel(reservation.segments[0].services?.[0] || reservation.reservationType || 'con_desayuno')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Habitación asignada */}
            {reservation.room && (
              <div className={styles.infoCard}>
                <h3>Habitación Asignada</h3>
                <div className={styles.infoGrid}>
                  {isEditing ? (
                    <div className={styles.infoItem}>
                      <span className={styles.label}>Cambiar Habitación:</span>
                      <select
                        value={editData?.roomId || reservation.roomId}
                        onChange={(e) => handleEditChange('roomId', parseInt(e.target.value))}
                        className={styles.editSelect}
                      >
                        {rooms.map(room => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className={styles.infoItem} onClick={() => navigate(`/rooms/${reservation.room.id}`)} style={{ cursor: 'pointer' }}>
                        <span className={styles.label}>Habitación:</span>
                        <span className={styles.value}>{reservation.room.name}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>Tipo:</span>
                        <span className={styles.value}>{reservation.room.roomType?.name}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>Capacidad:</span>
                        <span className={styles.value}>{reservation.room.maxPeople} personas</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Notas */}
            {reservation.notes && (
              <div className={styles.infoCard}>
                <h3>Notas</h3>
                <div className={styles.notesContent}>
                  {reservation.notes}
                </div>
              </div>
            )}

            {/* Botón de guardar cuando está editando */}
            {isEditing && (
              <div className={styles.saveSection}>
                <button 
                  onClick={handleEditSave}
                  className={styles.saveButton}
                >
                  <FaSave /> Guardar Cambios
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer del main content */}
        <div className={styles.mainContentFooter}>
          <div className={styles.mainTotalSection}>
            <div className={styles.mainTotalRow}>
              <span>Total de la Reserva:</span>
              <span className={styles.mainTotalAmount}>
                {reservation.totalAmount ? `$${reservation.totalAmount.toLocaleString('es-AR')}` : 'No disponible'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>⚠️ Confirmar Acción</h3>
            </div>
            <div className={styles.modalBody}>
              <p>
                Estás a punto de <strong>eliminar permanentemente</strong> la reserva #{reservation.id}.
              </p>
              <p>
                Esta acción <strong>no se puede deshacer</strong> y eliminará todos los registros 
                relacionados con esta reserva del sistema.
              </p>
              <p>
                ¿No preferirías cambiar el estado de la reserva a <strong>"Cancelada"</strong> 
                en su lugar? Esto mantendría un registro histórico de la reserva.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button 
                onClick={handleDeleteReservation}
                className={`${styles.modalButton} ${styles.deleteButton}`}
              >
                <FaTrash />
                Eliminar Definitivamente
              </button>
              <button 
                onClick={handleCancelReservation}
                className={`${styles.modalButton} ${styles.cancelButton}`}
              >
                ❌ Marcar como Cancelada
              </button>
              <button 
                onClick={handleCloseDeleteModal}
                className={`${styles.modalButton} ${styles.backButton}`}
              >
                ← Volver Atrás
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationDetails;
