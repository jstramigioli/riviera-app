import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPen } from 'react-icons/fa';
import { FiCopy, FiCheck } from 'react-icons/fi';
import ReservationStatusButtons from './ReservationStatusButtons';
import ReservationPanelMoreMenu from './ReservationPanelMoreMenu';
import ClientContactLinks from './ClientContactLinks';
import ReservationStayTimeline from './ReservationStayTimeline';
import { buildReservationStayTimeline } from '../utils/reservationStayTimeline';
import { copyReservationClientSummary } from '../utils/reservationClientSummary';
import { buildConsultaEditPath, buildConsultaEditState } from '../utils/consultaNavigation';
import { sourceLabel } from '../constants/reservationSource';
import { useAppNotice } from '../hooks/useAppNotice';
import { formatMoneyArs } from '../utils/formatMoney';
import {
  fetchComidasDeReserva,
  fetchServiceTypes,
  getReservationFinancialSummary
} from '../services/api';
import ReservationIdChip from './ReservationIdChip';
import styles from './ReservationDetailsPanel.module.css';

const formatCurrency = formatMoneyArs;

const ReservationDetailsPanel = ({
  reservation,
  onStatusChange,
  onDelete,
  onOpenFullEdit,
  onClose,
  onAddConsumo
}) => {
  const navigate = useNavigate();
  const { notify, noticeDialog } = useAppNotice();
  const [serviceTypes, setServiceTypes] = useState([]);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [almuerzosDisponibles, setAlmuerzosDisponibles] = useState(0);
  /** Saldo de la cuenta de la reserva (cargos − cobros − descuentos); null mientras carga o si falla. */
  const [saldo, setSaldo] = useState(null);

  useEffect(() => {
    setSaldo(null);
    if (!reservation?.id) return undefined;
    let cancelled = false;
    getReservationFinancialSummary(reservation.id)
      .then((res) => {
        const value = Number(res?.resumen?.saldo);
        if (!cancelled && Number.isFinite(value)) setSaldo(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reservation?.id, reservation?.status, reservation?.updatedAt]);

  // Almuerzos sin cargo disponibles (por cena incluida cancelada).
  useEffect(() => {
    setAlmuerzosDisponibles(0);
    if (!reservation?.id) return undefined;
    let cancelled = false;
    fetchComidasDeReserva(reservation.id)
      .then((res) => {
        if (!cancelled) setAlmuerzosDisponibles(Number(res?.data?.beneficiosDisponibles) || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reservation?.id, reservation?.status, reservation?.updatedAt]);

  useEffect(() => {
    const loadServiceTypes = async () => {
      try {
        setServiceTypes(await fetchServiceTypes());
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

  const handleClientClick = (clientId) => {
    const id = clientId || reservation.mainClient?.id;
    if (id) navigate(`/clients/${id}`);
  };

  const goToFullPageEdit = () => {
    if (onOpenFullEdit) {
      onOpenFullEdit(reservation.id);
      return;
    }
    navigate(buildConsultaEditPath(reservation.id), {
      state: buildConsultaEditState(reservation.id)
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
  const totalLabel =
    stayHeader?.totalAmount > 0 ? formatCurrency(stayHeader.totalAmount) : '—';
  const canOpenClient = Boolean(clientId);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.titleRow}>
            <ReservationIdChip
              id={reservation.id}
              source={reservation.source}
              status={reservation.status}
              prefix="Reserva #"
              className={styles.titleChip}
              onClick={() => navigate(`/reservations/${reservation.id}`)}
              title={`Ver detalles de la Reserva #${reservation.id}`}
              data-testid="panel-reservation-id-chip"
            />
          </div>
          <div className={styles.reservationStatus}>
            <ReservationStatusButtons
              reservation={reservation}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              variant="plain"
              menuPlacement="below"
            />
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
            <ClientContactLinks
              phone={reservation.mainClient?.phone}
              email={reservation.mainClient?.email}
            />
          </div>
          <div className={styles.guestTotal} data-testid="panel-guest-total">
            <span className={styles.guestTotalLabel}>Total</span>
            <span className={styles.guestTotalAmount}>{totalLabel}</span>
            {saldo != null ? (
              <span
                className={`${styles.guestSaldo} ${
                  saldo > 0.009 ? styles.guestSaldoPendiente : styles.guestSaldoOk
                }`}
                data-testid="panel-guest-saldo"
              >
                {saldo > 0.009
                  ? `Saldo ${formatCurrency(saldo)}`
                  : saldo < -0.009
                    ? `A favor ${formatCurrency(Math.abs(saldo))}`
                    : 'Pagado'}
              </span>
            ) : null}
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
                <td className={styles.tableLabel}>Reservado por:</td>
                <td className={styles.tableValue}>{sourceLabel(reservation.source)}</td>
              </tr>
              {almuerzosDisponibles > 0 ? (
                <tr data-testid="panel-almuerzo-sin-cargo">
                  <td className={styles.tableLabel}>Almuerzo sin cargo:</td>
                  <td className={styles.tableValue}>
                    <button
                      type="button"
                      className={styles.inlineLink}
                      onClick={() =>
                        navigate(`/reservations/${reservation.id}`, { state: { activeTab: 'comidas' } })
                      }
                      title="Ver comidas de la reserva"
                    >
                      {almuerzosDisponibles === 1 ? '1 disponible' : `${almuerzosDisponibles} disponibles`}
                    </button>
                  </td>
                </tr>
              ) : null}
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
        <ReservationPanelMoreMenu
          reservation={reservation}
          onAddConsumo={onAddConsumo}
        />
      </div>
      {noticeDialog}
    </div>
  );
};

export default ReservationDetailsPanel;
