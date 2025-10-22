import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import styles from './ReservationConfirmationModal.module.css';

const ReservationConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  reservationData,
  isLoading = false
}) => {
  const navigate = useNavigate();
  const [serviceTypes, setServiceTypes] = useState([]);
  const [reservationStatus, setReservationStatus] = useState('PENDIENTE');
  
  // Determinar estados de reserva disponibles según la fecha de check-in (memoizado)
  const reservationStatuses = useMemo(() => {
    const statuses = [
      { value: 'PENDIENTE', label: 'Pendiente' },
      { value: 'CONFIRMADA', label: 'Confirmada' }
    ];
    
    // Solo permitir "Ingresada" si el check-in es hoy o anterior
    if (reservationData?.segments && reservationData.segments.length > 0) {
      const firstCheckIn = reservationData.segments[0].checkIn;
      if (firstCheckIn) {
        const checkInDate = new Date(firstCheckIn);
        const today = new Date();
        // Normalizar fechas a medianoche para comparar solo días
        checkInDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        if (checkInDate <= today) {
          statuses.push({ value: 'INGRESADA', label: 'Ingresada' });
        }
      }
    }
    
    return statuses;
  }, [reservationData]);
  
  // Cargar tipos de servicio
  useEffect(() => {
    const loadServiceTypes = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/service-types?hotelId=default-hotel');
        if (response.ok) {
          const data = await response.json();
          setServiceTypes(data.data || []);
        }
      } catch (error) {
        console.error('Error loading service types:', error);
      }
    };
    loadServiceTypes();
  }, []);

  // Verificar que el estado seleccionado sea válido cuando cambien las opciones disponibles
  useEffect(() => {
    const availableValues = reservationStatuses.map(s => s.value);
    if (!availableValues.includes(reservationStatus)) {
      setReservationStatus('PENDIENTE');
    }
  }, [reservationData, reservationStatus, reservationStatuses]);
  
  if (!isOpen) return null;

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

  const getChangeDescription = (currentSegment, nextSegment) => {
    const changes = [];
    
    // Detectar cambio de servicio
    if (currentSegment.serviceType !== nextSegment.serviceType) {
      changes.push(`A partir de ${formatDate(nextSegment.checkIn)}, ${getServiceTypeLabel(nextSegment.serviceType)}`);
    }
    
    // Detectar cambio de huéspedes
    if (currentSegment.requiredGuests !== nextSegment.requiredGuests) {
      changes.push(`A partir de ${formatDate(nextSegment.checkIn)}, ${nextSegment.requiredGuests} huéspedes`);
    }
    
    // Detectar cambio de etiquetas
    const currentTags = currentSegment.requiredTags || [];
    const nextTags = nextSegment.requiredTags || [];
    if (JSON.stringify(currentTags.sort()) !== JSON.stringify(nextTags.sort())) {
      changes.push(`A partir de ${formatDate(nextSegment.checkIn)}, cambio de requerimientos`);
    }
    
    return changes.length > 0 ? changes.join(' • ') : `A partir de ${formatDate(nextSegment.checkIn)}`;
  };

  const handleConfirm = () => {
    onConfirm(reservationStatus);
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <div className={styles.icon}>🏨</div>
          <h2 className={styles.title}>Datos de la Reserva</h2>
        </div>
        
        <div className={styles.body}>
          {/* Cliente */}
          <div className={styles.clientSection}>
            <span className={styles.clientName} onClick={() => navigate(`/clients/${reservationData?.mainClient?.id || 'new'}`)}>
              {reservationData?.mainClient?.firstName} {reservationData?.mainClient?.lastName}
            </span>
          </div>

          {/* Información General */}
          {reservationData?.segments && reservationData.segments.length > 0 && (
            <div className={styles.infoSection}>
              <table className={styles.infoTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Huéspedes:</td>
                    <td className={styles.tableValue}>
                      {reservationData.segments[0].requiredGuests} persona{reservationData.segments[0].requiredGuests > 1 ? 's' : ''}
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.tableLabel}>Servicio:</td>
                    <td className={styles.tableValue}>
                      {getServiceTypeLabel(reservationData.segments[0].serviceType)}
                    </td>
                  </tr>
                  {reservationData?.selectedRoom && (
                    <tr>
                      <td className={styles.tableLabel}>Habitación asignada:</td>
                      <td className={styles.tableValue}>
                        {reservationData.selectedRoom.name}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Fechas globales de estancia */}
          {reservationData?.segments && reservationData.segments.length > 0 && (
            <div className={styles.staySection}>
              <table className={styles.stayTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Check-in:</td>
                    <td className={styles.tableValue}>{formatDate(reservationData.segments[0].checkIn)}</td>
                  </tr>
                  <tr>
                    <td className={styles.tableLabel}>Check-out:</td>
                    <td className={styles.tableValue}>{formatDate(reservationData.segments[reservationData.segments.length - 1].checkOut)}</td>
                  </tr>
                  <tr>
                    <td className={styles.tableLabel}>Noches:</td>
                    <td className={styles.tableValue}>
                      {(() => {
                        const firstCheckIn = new Date(reservationData.segments[0].checkIn);
                        const lastCheckOut = new Date(reservationData.segments[reservationData.segments.length - 1].checkOut);
                        return Math.ceil((lastCheckOut - firstCheckIn) / (1000 * 60 * 60 * 24));
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Segmentos detallados (si hay múltiples) */}
          {reservationData?.segments && reservationData.segments.length > 1 && (
            <div className={styles.segmentsSection}>
              {reservationData.segments.map((segment, index) => {
                const selectedRoom = reservationData.selectedRoomsPerBlock?.[index];
                const serviceTypeName = getServiceTypeLabel(segment.serviceType);
                const requiredRoom = segment.requiredRoomId 
                  ? reservationData.allRooms?.find(r => r.id === segment.requiredRoomId)
                  : null;
                
                return (
                  <div key={segment.id} className={styles.segmentDetail}>
                    <div className={styles.segmentTitle}>
                      {formatDate(segment.checkIn)} – {formatDate(segment.checkOut)}
                    </div>
                    <div className={styles.segmentInfo}>
                      <div><strong>Servicio:</strong> {serviceTypeName}</div>
                      <div><strong>Habitación:</strong> {selectedRoom?.name || 'No especificada'}</div>
                      
                      {requiredRoom && (
                        <div><strong>Habitación requerida:</strong> {requiredRoom.name}</div>
                      )}
                      
                      {segment.requiredTags && segment.requiredTags.length > 0 && (
                        <div>
                          <strong>Requerimientos especiales:</strong>
                          <div className={styles.tagsContainer} style={{ marginTop: '4px' }}>
                            {segment.requiredTags.map(tagId => {
                              const tag = reservationData.tags?.find(t => t.id === tagId);
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

          {/* Habitación y requerimientos (solo si es segmento único) */}
          {reservationData?.segments && reservationData.segments.length === 1 && (
            <div className={styles.roomSection}>
              <table className={styles.roomTable}>
                <tbody>
                  {reservationData?.selectedRoom && (
                    <>
                      <tr>
                        <td className={styles.tableLabel}>Tipo de habitación:</td>
                        <td className={styles.tableValue}>{reservationData.selectedRoom.roomType?.name}</td>
                      </tr>
                      <tr>
                        <td className={styles.tableLabel}>Capacidad:</td>
                        <td className={styles.tableValue}>{reservationData.selectedRoom.maxPeople} personas</td>
                      </tr>
                    </>
                  )}
                  {reservationData.segments[0].requiredRoomId && (
                    <tr>
                      <td className={styles.tableLabel}>Habitación requerida:</td>
                      <td className={styles.tableValue}>
                        {reservationData.allRooms?.find(r => r.id === reservationData.segments[0].requiredRoomId)?.name || 'No especificada'}
                      </td>
                    </tr>
                  )}
                  {reservationData.segments[0].requiredTags && reservationData.segments[0].requiredTags.length > 0 && (
                    <tr>
                      <td className={styles.tableLabel}>Requerimientos especiales:</td>
                      <td className={styles.tableValue}>
                        <div className={styles.tagsContainer}>
                          {reservationData.segments[0].requiredTags.map(tagId => {
                            const tag = reservationData.tags?.find(t => t.id === tagId);
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

          {/* Total */}
          {reservationData?.dailyRates && reservationData.dailyRates.length > 0 && (
            <div className={styles.totalSection}>
              <table className={styles.totalTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Monto total:</td>
                    <td className={styles.tableValue}>
                      ${reservationData.dailyRates.reduce((sum, rate) => 
                        sum + (rate.price || 0), 0).toLocaleString('es-AR')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Notas */}
          {reservationData?.notes && reservationData.notes.trim() !== '' && (
            <div className={styles.notesSection}>
              <table className={styles.notesTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Notas:</td>
                    <td className={styles.tableValue}>
                      {reservationData.notes}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Estado de la reserva */}
          <div className={styles.statusSection}>
            <table className={styles.statusTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Estado inicial:</td>
                  <td className={styles.tableValue}>
                    <select 
                      value={reservationStatus} 
                      onChange={(e) => setReservationStatus(e.target.value)}
                      className={styles.statusSelect}
                    >
                      {reservationStatuses.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div className={styles.footer}>
          <button 
            onClick={handleCancel} 
            className={styles.cancelButton}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm} 
            className={styles.confirmButton}
            disabled={isLoading}
          >
            {isLoading ? 'Creando...' : 'Crear Reserva'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationConfirmationModal; 