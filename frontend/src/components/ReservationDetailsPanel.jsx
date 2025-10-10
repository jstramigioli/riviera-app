import React, { useState, useEffect } from 'react';
import { getStatusLabel } from "../utils/reservationStatusUtils";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import ReservationStatusButtons from './ReservationStatusButtons';
import styles from './ReservationDetailsPanel.module.css';

const ReservationDetailsPanel = ({ reservation, onStatusChange }) => {
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
  
  if (!reservation) return null;

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

  const getStatusColor = (status) => {
    const statusColors = {
      'PENDIENTE': '#ffc107',      // Amarillo - Pendiente de confirmación
      'CONFIRMADA': '#17a2b8',     // Azul cian - Confirmada, esperando llegada
      'INGRESADA': '#28a745',      // Verde - Actualmente en el hotel
      'FINALIZADA': '#6c757d',     // Gris - Estadía completada
      'CANCELADA': '#dc3545',      // Rojo - Cancelada
      'NO_PRESENTADA': '#fd7e14'   // Naranja - No se presentó
    };
    return statusColors[status] || '#6c757d';
  };

  const getChangeDescription = (currentSegment, nextSegment) => {
    const changes = [];
    
    // Detectar cambio de servicio
    if (currentSegment.serviceType !== nextSegment.serviceType) {
      changes.push(`A partir de ${formatDate(nextSegment.startDate)}, ${getServiceTypeLabel(nextSegment.serviceType)}`);
    }
    
    // Detectar cambio de huéspedes
    if (currentSegment.guestCount !== nextSegment.guestCount) {
      changes.push(`A partir de ${formatDate(nextSegment.startDate)}, ${nextSegment.guestCount} huéspedes`);
    }
    
    // Detectar cambio de etiquetas y mostrar específicamente qué cambió
    const currentTags = currentSegment.services || [];
    const nextTags = nextSegment.services || [];
    if (JSON.stringify(currentTags.sort()) !== JSON.stringify(nextTags.sort())) {
      // Encontrar etiquetas que se agregaron
      const addedTags = nextTags.filter(tag => !currentTags.includes(tag));
      // Encontrar etiquetas que se removieron
      const removedTags = currentTags.filter(tag => !nextTags.includes(tag));
      
      if (addedTags.length > 0 && removedTags.length > 0) {
        // Si hay múltiples cambios, mostrar un resumen más detallado
        if (addedTags.length === 1 && removedTags.length === 1) {
          changes.push(`A partir de ${formatDate(nextSegment.startDate)}, cambio de ${getServiceTypeLabel(removedTags[0])} a ${getServiceTypeLabel(addedTags[0])}`);
        } else {
          const removedText = removedTags.map(tag => getServiceTypeLabel(tag)).join(', ');
          const addedText = addedTags.map(tag => getServiceTypeLabel(tag)).join(', ');
          changes.push(`A partir de ${formatDate(nextSegment.startDate)}, cambia ${removedText} por ${addedText}`);
        }
      } else if (addedTags.length > 0) {
        if (addedTags.length === 1) {
          changes.push(`A partir de ${formatDate(nextSegment.startDate)}, agrega ${getServiceTypeLabel(addedTags[0])}`);
        } else {
          const addedText = addedTags.map(tag => getServiceTypeLabel(tag)).join(', ');
          changes.push(`A partir de ${formatDate(nextSegment.startDate)}, agrega ${addedText}`);
        }
      } else if (removedTags.length > 0) {
        if (removedTags.length === 1) {
          changes.push(`A partir de ${formatDate(nextSegment.startDate)}, remueve ${getServiceTypeLabel(removedTags[0])}`);
        } else {
          const removedText = removedTags.map(tag => getServiceTypeLabel(tag)).join(', ');
          changes.push(`A partir de ${formatDate(nextSegment.startDate)}, remueve ${removedText}`);
        }
      }
    }
    
    return changes.length > 0 ? changes.join(' • ') : `A partir de ${formatDate(nextSegment.startDate)}`;
  };

  const handleClientClick = () => {
    if (reservation.mainClient?.id) {
      navigate(`/clients/${reservation.mainClient.id}`);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            <a 
              href={`/reservations/${reservation.id}`}
              onClick={(e) => { e.preventDefault(); navigate(`/reservations/${reservation.id}`); }}
              style={{ color: 'white', textDecoration: 'underline', cursor: 'pointer' }}
              title={`Ver detalles de la Reserva #${reservation.id}`}
            >
              Reserva #{reservation.id}
            </a>
          </h2>
          <div className={styles.reservationStatus}>
            <span 
              className={styles.statusIndicator} 
              style={{ backgroundColor: getStatusColor(reservation.status) }}
            ></span>
            {getStatusLabel(reservation.status)}
          </div>
        </div>
      </div>
      
      <div className={styles.body}>
        {/* Cliente */}
        <div className={styles.clientSection}>
          <span 
            className={styles.clientName} 
            onClick={handleClientClick}
            style={{ cursor: reservation.mainClient?.id ? 'pointer' : 'default' }}
          >
            {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
          </span>
        </div>

        {/* Información de Huéspedes y Servicio */}
        {reservation.segments && reservation.segments.length > 0 && (
          <div className={styles.requirementsSection}>
            <table className={styles.requirementsTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Huéspedes:</td>
                  <td className={styles.tableValue}>
                    {reservation.segments[0].guestCount || reservation.requiredGuests || 1} persona{(reservation.segments[0].guestCount || reservation.requiredGuests || 1) > 1 ? 's' : ''}
                  </td>
                </tr>
                <tr>
                  <td className={styles.tableLabel}>Servicio:</td>
                  <td className={styles.tableValue}>
                    {getServiceTypeLabel(reservation.segments[0].services?.[0] || reservation.reservationType || 'con_desayuno')}
                  </td>
                </tr>
                <tr>
                  <td className={styles.tableLabel}>Etiquetas:</td>
                  <td className={styles.tableValue}>
                    {reservation.segments[0].services && reservation.segments[0].services.length > 0 ? (
                      <div className={styles.tagsContainer}>
                        {reservation.segments[0].services.map((service, index) => (
                          <span key={index} className={styles.tag}>
                            {getServiceTypeLabel(service)}
                          </span>
                        ))}
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
        {reservation.segments && reservation.segments.length > 0 && (
          <div className={styles.staySection}>
            <div className={styles.stayPeriod}>
              <table className={styles.stayTable}>
                <tbody>
                  <tr>
                    <td className={styles.tableLabel}>Check-in:</td>
                    <td className={styles.tableValue}>{formatDate(reservation.segments[0].startDate)}</td>
                  </tr>
                  <tr>
                    <td className={styles.tableLabel}>Check-out:</td>
                    <td className={styles.tableValue}>{formatDate(reservation.segments[reservation.segments.length - 1].endDate)}</td>
                  </tr>
                  <tr>
                    <td className={styles.tableLabel}>Noches:</td>
                    <td className={styles.tableValue}>
                      {Math.ceil((new Date(reservation.segments[reservation.segments.length - 1].endDate) - new Date(reservation.segments[0].startDate)) / (1000 * 60 * 60 * 24))}
                    </td>
                  </tr>
                </tbody>
              </table>
              
              {/* Mostrar cambios entre segmentos si hay más de uno */}
              {reservation.segments.length > 1 && (
                <div>
                  {reservation.segments.map((segment, index) => (
                    index < reservation.segments.length - 1 && (
                      <div key={`change-${segment.id}`} className={styles.changeIndicator}>
                        {getChangeDescription(reservation.segments[index], reservation.segments[index + 1])}
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Habitación */}
        {reservation.room && (
          <div className={styles.roomSection}>
            <table className={styles.roomTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Habitación:</td>
                  <td className={styles.tableValue}>
                    <a 
                      href={`/rooms/${reservation.room.id}`}
                      onClick={(e) => { e.preventDefault(); navigate(`/rooms/${reservation.room.id}`); }}
                      style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
                      title={`Ver detalles de la habitación ${reservation.room.name}`}
                    >
                      {reservation.room.name}
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Total */}
        {reservation.totalAmount && (
          <div className={styles.totalSection}>
            <table className={styles.totalTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Monto:</td>
                  <td className={styles.tableValue}>
                    ${reservation.totalAmount.toLocaleString('es-AR')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Notas */}
        {reservation.notes && (
          <div className={styles.statusSection}>
            <table className={styles.statusTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Notas:</td>
                  <td className={styles.tableValue}>{reservation.notes}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Botones de Estado */}
        <ReservationStatusButtons 
          reservation={reservation} 
          onStatusChange={onStatusChange} 
        />
      </div>
    </div>
  );
};

export default ReservationDetailsPanel;
