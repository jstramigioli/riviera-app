import React, { useState, useEffect } from 'react';
import { getStatusLabel } from '../utils/reservationStatusUtils';
import { useNavigate } from 'react-router-dom';
import { FaPen } from 'react-icons/fa';
import ReservationStatusButtons from './ReservationStatusButtons';
import ReservationPanelMoreMenu from './ReservationPanelMoreMenu';
import ClientContactLinks from './ClientContactLinks';
import ReservationStayTimeline from './ReservationStayTimeline';
import {
  RESERVATION_SOURCE_OPTIONS,
  sourceLabel
} from '../constants/reservationSource';
import styles from './ReservationDetailsPanel.module.css';

const ReservationDetailsPanel = ({
  reservation,
  onStatusChange,
  onSourceChange,
  onDelete,
  onOpenFullEdit,
  onClose
}) => {
  const navigate = useNavigate();
  const [serviceTypes, setServiceTypes] = useState([]);
  const [savingSource, setSavingSource] = useState(false);

  useEffect(() => {
    const loadServiceTypes = async () => {
      try {
        const response = await fetch(
          'http://localhost:3001/api/service-types?hotelId=default-hotel'
        );
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

  const getServiceTypeLabel = (serviceTypeId) => {
    if (!serviceTypeId) return 'No especificado';
    const serviceType = serviceTypes.find((st) => st.id === serviceTypeId);
    return serviceType ? serviceType.name : serviceTypeId;
  };

  const getStatusColor = (status) => {
    const statusColors = {
      PENDIENTE: '#ffc107',
      CONFIRMADA: '#17a2b8',
      INGRESADA: '#28a745',
      FINALIZADA: '#6c757d',
      CANCELADA: '#dc3545',
      NO_PRESENTADA: '#fd7e14'
    };
    return statusColors[status] || '#6c757d';
  };

  const handleClientClick = (clientId) => {
    const id = clientId || reservation.mainClient?.id;
    if (id) navigate(`/clients/${id}`);
  };

  const goToFullPageEdit = () => {
    if (onOpenFullEdit) {
      onOpenFullEdit(reservation.id);
      return;
    }
    navigate('/consulta', {
      state: {
        isEditingReservation: true,
        reservationId: reservation.id,
        reservationEdit: { id: reservation.id }
      }
    });
  };

  const handleSourceSelect = async (value) => {
    if (!onSourceChange) return;
    const next = value || null;
    if ((reservation.source || null) === next) return;
    try {
      setSavingSource(true);
      await onSourceChange(reservation.id, next);
    } finally {
      setSavingSource(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h2 className={styles.title}>
            <a
              href={`/reservations/${reservation.id}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/reservations/${reservation.id}`);
              }}
              style={{
                color: 'white',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
              title={`Ver detalles de la Reserva #${reservation.id}`}
            >
              Reserva #{reservation.id}
            </a>
          </h2>
          <div className={styles.reservationStatus}>
            <span
              className={styles.statusIndicator}
              style={{ backgroundColor: getStatusColor(reservation.status) }}
            />
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
        <div className={styles.contactSection}>
          <ClientContactLinks
            phone={reservation.mainClient?.phone}
            email={reservation.mainClient?.email}
          />
        </div>

        <ReservationStayTimeline
          reservation={reservation}
          getServiceTypeLabel={getServiceTypeLabel}
          onClientClick={handleClientClick}
          orientation="vertical"
          compact
        />

        <div className={styles.metaSection}>
          <table className={styles.metaTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Medio:</td>
                <td className={styles.tableValue}>
                  {onSourceChange ? (
                    <select
                      value={reservation.source || ''}
                      onChange={(e) => handleSourceSelect(e.target.value)}
                      disabled={savingSource}
                      aria-label="Medio de origen de la reserva"
                      className={styles.sourceSelect}
                    >
                      <option value="">No especificado</option>
                      {RESERVATION_SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    sourceLabel(reservation.source)
                  )}
                </td>
              </tr>
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
        <div className={styles.actionsRowStatus}>
          <ReservationStatusButtons
            reservation={reservation}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        </div>
        <ReservationPanelMoreMenu reservation={reservation} />
      </div>
    </div>
  );
};

export default ReservationDetailsPanel;
