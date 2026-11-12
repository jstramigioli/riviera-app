import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { getReservationsWithBalances } from '../services/api';
import { useAppNotice } from '../hooks/useAppNotice';
import PaymentForm from '../components/PaymentForm';
import styles from './CobrosPagos.module.css';

const STATUS_COLORS = {
  PENDIENTE: '#e03131',
  PAGADO: '#2f9e44',
  A_FAVOR: '#f59f00',
};

const DEFAULT_FILTERS = {
  PENDIENTE: true,
  PAGADO: false,
  A_FAVOR: false,
};

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(isoDate) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(isoDate) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const CobrosPagos = () => {
  const navigate = useNavigate();
  const { notify, noticeDialog } = useAppNotice();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientIdParam = searchParams.get('clientId');

  const [reservationsWithBalances, setReservationsWithBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  const [statusFilters, setStatusFilters] = useState(DEFAULT_FILTERS);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const balancesData = await getReservationsWithBalances();
      setReservationsWithBalances(balancesData || []);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(Number(price) || 0);

  const toggleStatus = (status) => {
    setStatusFilters((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const filteredRows = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);
    const clientId = clientIdParam ? Number(clientIdParam) : null;

    return (reservationsWithBalances || []).filter((reservation) => {
      const status = reservation.estadoPago || 'PENDIENTE';
      if (!statusFilters[status]) return false;

      if (clientId != null && !Number.isNaN(clientId)) {
        const matchesClient =
          reservation.mainClient?.id === clientId ||
          Number(reservation.mainClientId) === clientId;
        if (!matchesClient) return false;
      }

      if (from || to) {
        // Fecha de referencia: último pago si hay, si no updatedAt/createdAt de la reserva
        const paymentDates = (reservation.pagos || [])
          .map((pago) => (pago.fecha ? new Date(pago.fecha) : null))
          .filter((d) => d && !Number.isNaN(d.getTime()));
        const refDate =
          paymentDates.length > 0
            ? new Date(Math.max(...paymentDates.map((d) => d.getTime())))
            : new Date(reservation.updatedAt || reservation.createdAt);

        if (Number.isNaN(refDate.getTime())) return false;
        if (from && refDate < from) return false;
        if (to && refDate > to) return false;
      }

      return true;
    });
  }, [reservationsWithBalances, statusFilters, dateFrom, dateTo, clientIdParam]);

  const handleClientClick = (client) => {
    if (!client?.id) return;
    navigate(`/clients/${client.id}`);
  };

  const handleAddPayment = (reservation) => {
    setSelectedReservation(reservation);
    setShowPaymentForm(true);
  };

  const handleClosePaymentForm = () => {
    setShowPaymentForm(false);
    setSelectedReservation(null);
  };

  const handlePaymentSuccess = (nuevoPago) => {
    if (nuevoPago?.id != null) {
      notify({
        title: 'Pago registrado',
        message: `Nº ${nuevoPago.id} — anotalo en el papelito. Reserva #${nuevoPago.reservaId || selectedReservation?.id || '—'}.`,
        type: 'success',
      });
    }
    loadData();
  };

  if (loading) {
    return <div className={styles.loading}>Cargando datos...</div>;
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <div className={styles.error}>{error}</div>
        <button type="button" onClick={loadData} className={styles.retryButton}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Cobros y Pagos</h1>
          <p className={styles.subtitle}>
            Lista unificada de saldos. Cada pago tiene un Nº para papelitos.
          </p>
        </div>
      </header>

      <section className={styles.filters} aria-label="Filtros de cobros">
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Mostrar</span>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={statusFilters.PENDIENTE}
              onChange={() => toggleStatus('PENDIENTE')}
            />
            Pendientes
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={statusFilters.PAGADO}
              onChange={() => toggleStatus('PAGADO')}
            />
            Saldos pagados
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={statusFilters.A_FAVOR}
              onChange={() => toggleStatus('A_FAVOR')}
            />
            A favor
          </label>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Fechas</span>
          <label className={styles.dateField}>
            Desde
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className={styles.dateField}>
            Hasta
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              className={styles.clearDates}
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
            >
              Limpiar fechas
            </button>
          )}
        </div>

        {clientIdParam && (
          <div className={styles.filterGroup}>
            <span className={styles.meta}>Filtro cliente #{clientIdParam}</span>
            <button
              type="button"
              className={styles.clearDates}
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('clientId');
                setSearchParams(next, { replace: true });
              }}
            >
              Quitar filtro de cliente
            </button>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>
            {filteredRows.length} resultado{filteredRows.length === 1 ? '' : 's'}
          </h2>
        </div>

        {filteredRows.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay cobros con los filtros actuales</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Nº pagos</th>
                  <th>Cliente</th>
                  <th>Cargos</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th>Último mov.</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((reservation) => {
                  const client = reservation.mainClient;
                  const clientName = client
                    ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                    : 'Sin cliente';
                  const statusColor =
                    STATUS_COLORS[reservation.estadoPago] || '#6b7280';
                  const payments = (reservation.pagos || [])
                    .slice()
                    .sort((a, b) => Number(a.id) - Number(b.id));
                  const lastPaymentDate =
                    payments.length > 0
                      ? payments.reduce((latest, pago) => {
                          const d = pago.fecha ? new Date(pago.fecha) : null;
                          if (!d || Number.isNaN(d.getTime())) return latest;
                          if (!latest || d > latest) return d;
                          return latest;
                        }, null)
                      : null;
                  const lastMove =
                    lastPaymentDate ||
                    (reservation.updatedAt
                      ? new Date(reservation.updatedAt)
                      : reservation.createdAt
                        ? new Date(reservation.createdAt)
                        : null);

                  return (
                    <tr key={reservation.id} className={styles.row}>
                      <td className={styles.idCell}>#{reservation.id}</td>
                      <td>
                        {payments.length > 0 ? (
                          <div
                            className={styles.paymentIdList}
                            title="Números de pago para papelitos"
                          >
                            {payments.map((pago) => (
                              <span key={pago.id} className={styles.paymentId}>
                                Nº {pago.id}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className={styles.meta}>Sin pagos</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => handleClientClick(client)}
                          title="Ver cliente"
                        >
                          {clientName || 'Sin cliente'}
                        </button>
                        {client?.email && (
                          <div className={styles.meta}>{client.email}</div>
                        )}
                      </td>
                      <td>{formatPrice(reservation.totalCargos)}</td>
                      <td>{formatPrice(reservation.totalPagos)}</td>
                      <td className={styles.amountCell} style={{ color: statusColor }}>
                        {formatPrice(reservation.saldo)}
                      </td>
                      <td>
                        <span
                          className={styles.statusBadge}
                          style={{ backgroundColor: statusColor }}
                        >
                          {reservation.estadoPago}
                        </span>
                      </td>
                      <td className={styles.metaCell}>
                        {lastMove && !Number.isNaN(lastMove.getTime())
                          ? toDateInputValue(lastMove).split('-').reverse().join('/')
                          : '—'}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.paymentButton}
                            onClick={() => handleAddPayment(reservation)}
                            title="Agregar pago"
                          >
                            <FiPlus aria-hidden="true" />
                            Agregar pago
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPaymentForm && selectedReservation && (
        <PaymentForm
          reservaId={selectedReservation.id}
          onClose={handleClosePaymentForm}
          onSuccess={handlePaymentSuccess}
        />
      )}
      {noticeDialog}
    </div>
  );
};

export default CobrosPagos;
