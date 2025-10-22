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
  const [serviceTypes, setServiceTypes] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    const loadReservationData = async () => {
      try {
        setLoading(true);
        
        // Cargar datos necesarios
        const [reservationsData, roomsData, serviceTypesResponse, tagsResponse] = await Promise.all([
          fetchReservations(),
          fetchRooms(),
          fetch('http://localhost:3001/api/service-types?hotelId=default-hotel').then(res => res.json()),
          fetch('http://localhost:3001/api/tags').then(res => res.json())
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
        setServiceTypes(serviceTypesResponse.data || []);
        setTags(tagsResponse || []);
        
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

  const getServiceTypeLabel = (serviceTypeId) => {
    if (!serviceTypeId) return 'No especificado';
    
    // Buscar por ID
    const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
    
    // Si no se encuentra, mostrar error visible para detectar problemas
    if (!serviceType) {
      console.error('⚠️ ServiceType no encontrado:', serviceTypeId, 'Available:', serviceTypes);
      return `⚠️ Servicio inválido (ID: ${serviceTypeId})`;
    }
    
    return serviceType.name;
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
          {/* Cliente */}
          <div className={styles.clientSection}>
            <span className={styles.clientName} onClick={handleClientClick} style={{ cursor: reservation.mainClient?.id ? 'pointer' : 'default' }}>
              {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
            </span>
          </div>

          {/* Información General */}
          <div className={styles.infoSection}>
            <table className={styles.infoTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Huéspedes:</td>
                  <td className={styles.tableValue}>
                    {reservation.segments?.[0]?.guestCount || reservation.requiredGuests || 1} persona{(reservation.segments?.[0]?.guestCount || reservation.requiredGuests || 1) > 1 ? 's' : ''}
                  </td>
                </tr>
                <tr>
                  <td className={styles.tableLabel}>Servicio:</td>
                  <td className={styles.tableValue}>
                    {getServiceTypeLabel(reservation.segments?.[0]?.services?.[0] || reservation.reservationType)}
                  </td>
                </tr>
                {reservation.room && (
                  <>
                    <tr>
                      <td className={styles.tableLabel}>Habitación asignada:</td>
                      <td className={styles.tableValue} onClick={() => navigate(`/rooms/${reservation.room.id}`)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                        {reservation.room.name}
                      </td>
                    </tr>
                    <tr>
                      <td className={styles.tableLabel}>Tipo de habitación:</td>
                      <td className={styles.tableValue}>{reservation.room.roomType?.name || 'No especificado'}</td>
                    </tr>
                    <tr>
                      <td className={styles.tableLabel}>Capacidad:</td>
                      <td className={styles.tableValue}>{reservation.room.maxPeople} personas</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Fechas de estancia */}
          <div className={styles.staySection}>
            <table className={styles.stayTable}>
              <tbody>
                {isEditing ? (
                  <>
                    <tr>
                      <td className={styles.tableLabel}>Fecha de Entrada:</td>
                      <td className={styles.tableValue}>
                        <input
                          type="date"
                          value={editData?.checkIn ? format(new Date(editData.checkIn), 'yyyy-MM-dd') : ''}
                          onChange={(e) => handleEditChange('checkIn', e.target.value)}
                          className={styles.editInput}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className={styles.tableLabel}>Fecha de Salida:</td>
                      <td className={styles.tableValue}>
                        <input
                          type="date"
                          value={editData?.checkOut ? format(new Date(editData.checkOut), 'yyyy-MM-dd') : ''}
                          onChange={(e) => handleEditChange('checkOut', e.target.value)}
                          className={styles.editInput}
                        />
                      </td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <td className={styles.tableLabel}>Check-in:</td>
                      <td className={styles.tableValue}>{formatDate(reservation.checkIn)}</td>
                    </tr>
                    <tr>
                      <td className={styles.tableLabel}>Check-out:</td>
                      <td className={styles.tableValue}>{formatDate(reservation.checkOut)}</td>
                    </tr>
                    <tr>
                      <td className={styles.tableLabel}>Noches:</td>
                      <td className={styles.tableValue}>
                        {Math.ceil((new Date(reservation.checkOut) - new Date(reservation.checkIn)) / (1000 * 60 * 60 * 24))}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Segmentos detallados (si hay múltiples) */}
          {reservation.segments && reservation.segments.length > 1 && (
            <div className={styles.segmentsSection}>
              {reservation.segments.map((segment, index) => {
                const serviceTypeName = getServiceTypeLabel(segment.services?.[0]);
                const requiredRoom = segment.requiredRoomId 
                  ? rooms.find(r => r.id === segment.requiredRoomId)
                  : null;
                
                return (
                  <div key={segment.id || index} className={styles.segmentDetail}>
                    <div className={styles.segmentTitle}>
                      {formatDate(segment.startDate)} – {formatDate(segment.endDate)}
                    </div>
                    <div className={styles.segmentInfo}>
                      <div><strong>Servicio:</strong> {serviceTypeName}</div>
                      <div><strong>Habitación:</strong> {segment.room?.name || reservation.room?.name || 'No especificada'}</div>
                      
                      {requiredRoom && (
                        <div><strong>Habitación requerida:</strong> {requiredRoom.name}</div>
                      )}
                      
                      {segment.requiredTags && segment.requiredTags.length > 0 && (
                        <div>
                          <strong>Requerimientos especiales:</strong>
                          <div className={styles.tagsContainer} style={{ marginTop: '4px' }}>
                            {segment.requiredTags.map(tagId => {
                              const tag = tags.find(t => t.id === tagId);
                              return tag ? (
                                <span key={tagId} className={styles.tag}>
                                  {tag.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Requerimientos (solo si es segmento único y tiene requerimientos) */}
          {reservation.segments && reservation.segments.length === 1 && 
           (reservation.segments[0].requiredRoomId || (reservation.segments[0].requiredTags && reservation.segments[0].requiredTags.length > 0)) && (
            <div className={styles.infoSection}>
              <table className={styles.infoTable}>
                <tbody>
                  {reservation.segments[0].requiredRoomId && (
                    <tr>
                      <td className={styles.tableLabel}>Habitación requerida:</td>
                      <td className={styles.tableValue}>
                        {rooms.find(r => r.id === reservation.segments[0].requiredRoomId)?.name || 'No especificada'}
                      </td>
                    </tr>
                  )}
                  {reservation.segments[0].requiredTags && reservation.segments[0].requiredTags.length > 0 && (
                    <tr>
                      <td className={styles.tableLabel}>Requerimientos especiales:</td>
                      <td className={styles.tableValue}>
                        <div className={styles.tagsContainer}>
                          {reservation.segments[0].requiredTags.map(tagId => {
                            const tag = tags.find(t => t.id === tagId);
                            return tag ? (
                              <span key={tagId} className={styles.tag}>
                                {tag.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Notas */}
          {reservation.notes && reservation.notes.trim() !== '' && (
            <div className={styles.notesSection}>
              <table className={styles.notesTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Notas:</td>
                    <td className={styles.tableValue}>
                      {reservation.notes}
                    </td>
                  </tr>
                </tbody>
              </table>
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
