import React, { useMemo, useState, useEffect } from 'react';
import { getStatusLabel } from '../utils/reservationStatusUtils';
import { useNavigate } from 'react-router-dom';
import { FaPen } from 'react-icons/fa';
import { FiCopy, FiCheck } from 'react-icons/fi';
import ReservationStatusButtons from './ReservationStatusButtons';
import ReservationPanelMoreMenu from './ReservationPanelMoreMenu';
import ClientContactLinks from './ClientContactLinks';
import ReservationStayTimeline from './ReservationStayTimeline';
import { buildReservationStayTimeline } from '../utils/reservationStayTimeline';
import { copyReservationClientSummary } from '../utils/reservationClientSummary';
import { sourceLabel } from '../constants/reservationSource';
import { useAppNotice } from '../hooks/useAppNotice';
import styles from './ReservationDetailsPanel.module.css';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(amount);

const ReservationDetailsPanel = ({
  reservation,
  onStatusChange,
  onDelete,
  onOpenFullEdit,
  onClose
}) => {
  const navigate = useNavigate();
  const { notify, noticeDialog } = useAppNotice();
  const [serviceTypes, setServiceTypes] = useState([]);
  const [copiedSummary, setCopiedSummary] = useState(false);

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

  const getServiceTypeLabel = (serviceTypeId) => {
    if (!serviceTypeId) return 'No especificado';
    const serviceType = serviceTypes.find((st) => st.id === serviceTypeId);
    return serviceType ? serviceType.name : serviceTypeId;
  };

  const stayHeader = useMemo(() => {
    if (!reservation) return null;
    return buildReservationStayTimeline(reservation).header;
  }, [reservation]);

  if (!reservation) return null;

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

  const handleCopyClientSummary = async () => {
    try {
      await copyReservationClientSummary(reservation, { getServiceTypeLabel });
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 1600);
      notify({
        message: 'Resumen de la reserva copiado al portapapeles.',
        type: 'success',
        autoDismiss: true,
      });
    } catch (error) {
      console.error('Error al copiar resumen de reserva:', error);
      notify({
        title: 'Error al copiar',
        message: 'No se pudo copiar el resumen al portapapeles.',
        type: 'error'
      });
    }
  };

  const clientName = stayHeader?.clientName || '—';
  const clientId = stayHeader?.clientId || reservation.mainClient?.id || null;
  const nightsLabel = stayHeader?.totalNights
    ? `${stayHeader.totalNights} noche${stayHeader.totalNights === 1 ? '' : 's'}`
    : '—';
  const totalLabel =
    stayHeader?.totalAmount > 0 ? formatCurrency(stayHeader.totalAmount) : '—';
  const canOpenClient = Boolean(clientId);

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
            onClick={handleCopyClientSummary}
            title="Copiar resumen para el cliente"
            aria-label="Copiar resumen para el cliente"
            data-testid="panel-copy-summary"
          >
            {copiedSummary ? <FiCheck /> : <FiCopy />}
          </button>
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
        <div className={styles.guestSection} data-testid="panel-guest-header">
          <div className={styles.guestMain}>
            {canOpenClient ? (
              <button
                type="button"
                className={styles.guestNameButton}
                onClick={() => handleClientClick(clientId)}
                title="Ver perfil del cliente"
                data-testid="panel-client-link"
              >
                {clientName}
              </button>
            ) : (
              <h3 className={styles.guestName}>{clientName}</h3>
            )}
            <p className={styles.guestNights}>{nightsLabel}</p>
            <ClientContactLinks
              phone={reservation.mainClient?.phone}
              email={reservation.mainClient?.email}
            />
          </div>
          <div className={styles.guestTotal} data-testid="panel-guest-total">
            <span className={styles.guestTotalLabel}>Total</span>
            <span className={styles.guestTotalAmount}>{totalLabel}</span>
          </div>
        </div>

        <ReservationStayTimeline
          reservation={reservation}
          getServiceTypeLabel={getServiceTypeLabel}
          orientation="vertical"
          compact
          hideHeader
        />

        <div className={styles.metaSection}>
          <table className={styles.metaTable}>
            <tbody>
              <tr>
                <td className={styles.tableLabel}>Medio:</td>
                <td className={styles.tableValue}>{sourceLabel(reservation.source)}</td>
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
      {noticeDialog}
    </div>
  );
};

export default ReservationDetailsPanel;
