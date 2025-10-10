import React, { useState, useEffect } from 'react';
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
    const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
    return serviceType ? serviceType.name : serviceTypeId;
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
    onConfirm();
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

          {/* Información de Huéspedes y Servicio */}
          {reservationData?.segments && reservationData.segments.length > 0 && (
            <div className={styles.requirementsSection}>
              <h3 className={styles.requirementsTitle}>Requerimientos</h3>
              <table className={styles.requirementsTable}>
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
                  <tr>
                    <td className={styles.tableLabel}>Etiquetas:</td>
                    <td className={styles.tableValue}>
                      {reservationData.segments[0].requiredGuests && reservationData.segments[0].requiredTags && reservationData.segments[0].requiredTags.length > 0 ? (
                        <div className={styles.tagsContainer}>
                          {reservationData.segments[0].requiredTags.map(tagId => {
                            // Buscar el nombre de la etiqueta por ID
                            const tag = reservationData.tags?.find(t => t.id === tagId);
                            return tag ? (
                              <span key={tagId} className={styles.tag}>
                                {tag.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <span className={styles.noTags}>Sin etiquetas requeridas</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Estancia */}
          {reservationData?.segments && reservationData.segments.length > 0 && (
            <div className={styles.staySection}>
              <h3 className={styles.stayTitle}>Estancia</h3>
              {reservationData.segments.map((segment, index) => (
                <div key={segment.id} className={styles.stayPeriod}>
                  <table className={styles.stayTable}>
                    <tbody>
                      <tr>
                        <td className={styles.tableLabel}>Check-in:</td>
                        <td className={styles.tableValue}>{formatDate(segment.checkIn)}</td>
                      </tr>
                      <tr>
                        <td className={styles.tableLabel}>Check-out:</td>
                        <td className={styles.tableValue}>{formatDate(segment.checkOut)}</td>
                      </tr>
                      <tr>
                        <td className={styles.tableLabel}>Noches:</td>
                        <td className={styles.tableValue}>
                          {Math.ceil((new Date(segment.checkOut) - new Date(segment.checkIn)) / (1000 * 60 * 60 * 24))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  
                  {/* Mostrar cambio entre segmentos si hay más de uno */}
                  {index < reservationData.segments.length - 1 && (
                    <div className={styles.changeIndicator}>
                      {getChangeDescription(reservationData.segments[index], reservationData.segments[index + 1])}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Habitación */}
          {reservationData?.selectedRoom && (
            <div className={styles.roomSection}>
              <h3 className={styles.roomTitle}>Habitación</h3>
              <table className={styles.roomTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Nombre:</td>
                    <td className={styles.tableValue}>{reservationData.selectedRoom.name}</td>
                  </tr>
                  <tr>
                    <td className={styles.tableLabel}>Tipo:</td>
                    <td className={styles.tableValue}>{reservationData.selectedRoom.roomType?.name}</td>
                  </tr>
                  <tr>
                    <td className={styles.tableLabel}>Capacidad:</td>
                    <td className={styles.tableValue}>{reservationData.selectedRoom.maxPeople} personas</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Total */}
          {reservationData?.dailyRates && reservationData.dailyRates.length > 0 && (
            <div className={styles.totalSection}>
              <h3 className={styles.totalTitle}>Tarifa Total</h3>
              <table className={styles.totalTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Monto:</td>
                    <td className={styles.tableValue}>
                      ${reservationData.dailyRates.reduce((sum, rate) => 
                        sum + (rate.price || 0), 0).toLocaleString('es-AR')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
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
            {isLoading ? 'Creando...' : 'Confirmar Reserva'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationConfirmationModal; 