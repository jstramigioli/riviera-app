import React, { useState, useEffect } from 'react';
import { getStatusLabel } from "../utils/reservationStatusUtils";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { FaPen } from 'react-icons/fa';
import ReservationStatusButtons from './ReservationStatusButtons';
import styles from './ReservationDetailsPanel.module.css';

const ReservationDetailsPanel = ({
  reservation,
  onStatusChange,
  onDelete,
  onOpenFullEdit,
  onClose
}) => {
  const navigate = useNavigate();
  const [serviceTypes, setServiceTypes] = useState([]);
  
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
      'PENDIENTE': '#ffc107',
      'CONFIRMADA': '#17a2b8',
      'INGRESADA': '#28a745',
      'FINALIZADA': '#6c757d',
      'CANCELADA': '#dc3545',
      'NO_PRESENTADA': '#fd7e14'
    };
    return statusColors[status] || '#6c757d';
  };

  const getChangeDescription = (currentSegment, nextSegment) => {
    const changes = [];
    
    if (currentSegment.serviceType !== nextSegment.serviceType) {
      changes.push(`A partir de ${formatDate(nextSegment.startDate)}, ${getServiceTypeLabel(nextSegment.serviceType)}`);
    }
    
    if (currentSegment.guestCount !== nextSegment.guestCount) {
      changes.push(`A partir de ${formatDate(nextSegment.startDate)}, ${nextSegment.guestCount} huéspedes`);
    }
    
    const currentTags = currentSegment.services || [];
    const nextTags = nextSegment.services || [];
    if (JSON.stringify([...currentTags].sort()) !== JSON.stringify([...nextTags].sort())) {
      const addedTags = nextTags.filter(tag => !currentTags.includes(tag));
      const removedTags = currentTags.filter(tag => !nextTags.includes(tag));
      
      if (addedTags.length > 0 && removedTags.length > 0) {
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

  const guestCount = reservation.segments?.[0]?.guestCount || reservation.requiredGuests || 1;
  const serviceId = reservation.segments?.[0]?.services?.[0] || reservation.reservationType || '';
  const checkIn = reservation.segments?.[0]?.startDate || reservation.checkIn;
  const checkOut = reservation.segments?.[reservation.segments?.length - 1]?.endDate || reservation.checkOut;

  const goToFullPageEdit = () => {
    if (onOpenFullEdit) {
      onOpenFullEdit(reservation.id);
      return;
    }
    navigate(`/reservations/${reservation.id}`, { state: { isEditing: true } });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
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
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerIconBtn}
            onClick={goToFullPageEdit}
            title="Editar reserva"
            aria-label="Editar reserva"
          >
            <FaPen />
          </button>
          {onClose && (
            <button
              type="button"
              className={styles.headerIconBtn}
              onClick={onClose}
              title="Cerrar panel"
              aria-label="Cerrar panel"
            >
              &times;
            </button>
          )}
        </div>
      </div>
      
      <div className={styles.body}>
        <div className={styles.clientSection}>
          <span 
            className={styles.clientName} 
            onClick={handleClientClick}
            style={{ cursor: reservation.mainClient?.id ? 'pointer' : 'default' }}
          >
            {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
          </span>
        </div>

        <div className={styles.requirementsSection}>
          <table className={styles.requirementsTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Huéspedes:</td>
                <td className={styles.tableValue}>
                  {guestCount} persona{guestCount > 1 ? 's' : ''}
                </td>
              </tr>
              <tr>
                <td className={styles.tableLabel}>Servicio:</td>
                <td className={styles.tableValue}>
                  {getServiceTypeLabel(serviceId || 'con_desayuno')}
                </td>
              </tr>
              {reservation.segments?.[0]?.services?.length > 0 && (
                <tr>
                  <td className={styles.tableLabel}>Etiquetas:</td>
                  <td className={styles.tableValue}>
                    <div className={styles.tagsContainer}>
                      {reservation.segments[0].services.map((service, index) => (
                        <span key={index} className={styles.tag}>
                          {getServiceTypeLabel(service)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.staySection}>
          <div className={styles.stayPeriod}>
            <table className={styles.stayTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Check-in:</td>
                  <td className={styles.tableValue}>{formatDate(checkIn)}</td>
                </tr>
                <tr>
                  <td className={styles.tableLabel}>Check-out:</td>
                  <td className={styles.tableValue}>{formatDate(checkOut)}</td>
                </tr>
                {checkIn && checkOut && (
                  <tr>
                    <td className={styles.tableLabel}>Noches:</td>
                    <td className={styles.tableValue}>
                      {Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {reservation.segments?.length > 1 && (
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

        <div className={styles.roomSection}>
          <table className={styles.roomTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Habitación:</td>
                <td className={styles.tableValue}>
                  {reservation.room ? (
                    <a 
                      href={`/rooms/${reservation.room.id}`}
                      onClick={(e) => { e.preventDefault(); navigate(`/rooms/${reservation.room.id}`); }}
                      style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
                      title={`Ver detalles de la habitación ${reservation.room.name}`}
                    >
                      {reservation.room.name}
                    </a>
                  ) : (
                    'Sin habitación'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.totalSection}>
          <table className={styles.totalTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Monto:</td>
                <td className={styles.tableValue}>
                  ${(reservation.totalAmount || 0).toLocaleString('es-AR')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.statusSection}>
          <table className={styles.statusTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Notas:</td>
                <td className={styles.tableValue}>
                  {reservation.notes || 'Sin notas'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.actionsRow}>
        <ReservationStatusButtons
          reservation={reservation}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
};

export default ReservationDetailsPanel;
