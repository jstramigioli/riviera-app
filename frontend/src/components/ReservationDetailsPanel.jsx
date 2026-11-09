import React, { useState, useEffect } from 'react';
import { getStatusLabel } from "../utils/reservationStatusUtils";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { FaPen, FaTimes, FaExternalLinkAlt } from 'react-icons/fa';
import ReservationStatusButtons from './ReservationStatusButtons';
import styles from './ReservationDetailsPanel.module.css';

const fieldStyle = {
  fontSize: '0.95rem',
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  boxSizing: 'border-box'
};

const ReservationDetailsPanel = ({
  reservation,
  onStatusChange,
  isEditing = false,
  editData = null,
  rooms = [],
  clients = [],
  onEditToggle,
  onEditChange,
  onSave,
  onOpenFullEdit
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

  const data = isEditing && editData ? editData : reservation;

  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const toDateInput = (dateString) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return '';
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

  const handleSegmentField = (field, value) => {
    if (!onEditChange) return;
    const segments = [...(editData?.segments || reservation.segments || [])];
    if (!segments[0]) {
      segments[0] = {};
    }
    segments[0] = { ...segments[0], [field]: value };
    onEditChange('segments', segments);
  };

  const handleServiceChange = (serviceId) => {
    if (!onEditChange) return;
    const segments = [...(editData?.segments || reservation.segments || [])];
    if (!segments[0]) {
      segments[0] = {};
    }
    segments[0] = { ...segments[0], services: serviceId ? [serviceId] : [] };
    onEditChange('segments', segments);
  };

  const guestCount = data.segments?.[0]?.guestCount || data.requiredGuests || 1;
  const serviceId = data.segments?.[0]?.services?.[0] || data.reservationType || '';
  const checkIn = data.segments?.[0]?.startDate || data.checkIn;
  const checkOut = data.segments?.[data.segments?.length - 1]?.endDate || data.checkOut;

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
          {onEditToggle && (
            <button
              type="button"
              className={styles.headerActionBtn}
              onClick={onEditToggle}
              title={isEditing ? 'Cancelar edición' : 'Editar datos'}
            >
              {isEditing ? <FaTimes /> : <FaPen />}
              <span>{isEditing ? 'Cancelar' : 'Editar'}</span>
            </button>
          )}
          <button
            type="button"
            className={styles.headerActionBtn}
            onClick={goToFullPageEdit}
            title="Abrir página de reserva en modo edición"
          >
            <FaExternalLinkAlt />
            <span>Página</span>
          </button>
        </div>
      </div>
      
      <div className={styles.body}>
        {/* Cliente */}
        <div className={styles.clientSection}>
          {isEditing ? (
            <select
              value={data.mainClientId || reservation.mainClientId || ''}
              onChange={(e) => onEditChange('mainClientId', parseInt(e.target.value, 10))}
              style={fieldStyle}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.firstName} {client.lastName}
                </option>
              ))}
            </select>
          ) : (
            <span 
              className={styles.clientName} 
              onClick={handleClientClick}
              style={{ cursor: reservation.mainClient?.id ? 'pointer' : 'default' }}
            >
              {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
            </span>
          )}
        </div>

        {/* Información de Huéspedes y Servicio */}
        <div className={styles.requirementsSection}>
          <table className={styles.requirementsTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Huéspedes:</td>
                <td className={styles.tableValue}>
                  {isEditing ? (
                    <input
                      type="number"
                      min={1}
                      value={guestCount}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10) || 1;
                        handleSegmentField('guestCount', value);
                        onEditChange('requiredGuests', value);
                      }}
                      style={fieldStyle}
                    />
                  ) : (
                    <>
                      {guestCount} persona{guestCount > 1 ? 's' : ''}
                    </>
                  )}
                </td>
              </tr>
              <tr>
                <td className={styles.tableLabel}>Servicio:</td>
                <td className={styles.tableValue}>
                  {isEditing ? (
                    <select
                      value={serviceId}
                      onChange={(e) => handleServiceChange(e.target.value)}
                      style={fieldStyle}
                    >
                      <option value="">Seleccionar…</option>
                      {serviceTypes.map((st) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  ) : (
                    getServiceTypeLabel(serviceId || 'con_desayuno')
                  )}
                </td>
              </tr>
              {!isEditing && reservation.segments?.[0]?.services?.length > 0 && (
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

        {/* Estancia */}
        <div className={styles.staySection}>
          <div className={styles.stayPeriod}>
            <table className={styles.stayTable}>
              <tbody>
                <tr>
                  <td className={styles.tableLabel}>Check-in:</td>
                  <td className={styles.tableValue}>
                    {isEditing ? (
                      <input
                        type="date"
                        value={toDateInput(checkIn)}
                        onChange={(e) => {
                          onEditChange('checkIn', e.target.value);
                          handleSegmentField('startDate', e.target.value);
                        }}
                        style={fieldStyle}
                      />
                    ) : (
                      formatDate(checkIn)
                    )}
                  </td>
                </tr>
                <tr>
                  <td className={styles.tableLabel}>Check-out:</td>
                  <td className={styles.tableValue}>
                    {isEditing ? (
                      <input
                        type="date"
                        value={toDateInput(checkOut)}
                        onChange={(e) => {
                          onEditChange('checkOut', e.target.value);
                          if (!onEditChange) return;
                          const segments = [...(editData?.segments || reservation.segments || [])];
                          const lastIdx = Math.max(segments.length - 1, 0);
                          if (!segments[lastIdx]) segments[lastIdx] = {};
                          segments[lastIdx] = { ...segments[lastIdx], endDate: e.target.value };
                          onEditChange('segments', segments);
                        }}
                        style={fieldStyle}
                      />
                    ) : (
                      formatDate(checkOut)
                    )}
                  </td>
                </tr>
                {!isEditing && checkIn && checkOut && (
                  <tr>
                    <td className={styles.tableLabel}>Noches:</td>
                    <td className={styles.tableValue}>
                      {Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {!isEditing && reservation.segments?.length > 1 && (
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

        {/* Habitación */}
        <div className={styles.roomSection}>
          <table className={styles.roomTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Habitación:</td>
                <td className={styles.tableValue}>
                  {isEditing ? (
                    <select
                      value={data.roomId || reservation.roomId || ''}
                      onChange={(e) => onEditChange('roomId', parseInt(e.target.value, 10))}
                      style={fieldStyle}
                    >
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  ) : reservation.room ? (
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

        {/* Total */}
        <div className={styles.totalSection}>
          <table className={styles.totalTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Monto:</td>
                <td className={styles.tableValue}>
                  {isEditing ? (
                    <input
                      type="number"
                      value={data.totalAmount ?? reservation.totalAmount ?? 0}
                      onChange={(e) => onEditChange('totalAmount', parseFloat(e.target.value) || 0)}
                      style={fieldStyle}
                    />
                  ) : (
                    `$${(reservation.totalAmount || 0).toLocaleString('es-AR')}`
                  )}
                </td>
              </tr>
              {isEditing && (
                <tr>
                  <td className={styles.tableLabel}>Estado:</td>
                  <td className={styles.tableValue}>
                    <select
                      value={data.status || reservation.status}
                      onChange={(e) => onEditChange('status', e.target.value)}
                      style={fieldStyle}
                    >
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="CONFIRMADA">Confirmada</option>
                      <option value="INGRESADA">Ingresada</option>
                      <option value="FINALIZADA">Finalizada</option>
                      <option value="CANCELADA">Cancelada</option>
                      <option value="NO_PRESENTADA">No presentada</option>
                    </select>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Notas */}
        <div className={styles.statusSection}>
          <table className={styles.statusTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Notas:</td>
                <td className={styles.tableValue}>
                  {isEditing ? (
                    <textarea
                      value={data.notes ?? reservation.notes ?? ''}
                      onChange={(e) => onEditChange('notes', e.target.value)}
                      style={{ ...fieldStyle, minHeight: 60 }}
                      placeholder="Notas adicionales…"
                    />
                  ) : (
                    reservation.notes || 'Sin notas'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {isEditing && onSave && (
          <div className={styles.saveRow}>
            <button type="button" className={styles.saveButton} onClick={onSave}>
              Guardar cambios
            </button>
          </div>
        )}

        {/* Botones de Estado */}
        {!isEditing && (
          <ReservationStatusButtons 
            reservation={reservation} 
            onStatusChange={onStatusChange} 
          />
        )}
      </div>
    </div>
  );
};

export default ReservationDetailsPanel;
