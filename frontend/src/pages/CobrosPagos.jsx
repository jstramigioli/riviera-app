import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { getReservationsWithBalances, getAllPagos } from '../services/api';
import { useAppNotice } from '../hooks/useAppNotice';
import PaymentForm from '../components/PaymentForm';
import styles from './CobrosPagos.module.css';

const SECTIONS = {
  cuentas: 'cuentas',
  pagos: 'pagos',
};

const STATUS_COLORS = {
  PENDIENTE: '#e03131',
  PAGADO: '#2f9e44',
  A_FAVOR: '#f59f00',
};

const DEFAULT_STATUS_FILTERS = {
  PENDIENTE: true,
  PAGADO: false,
  A_FAVOR: false,
};

/** Reservas actualmente alojadas (check-in hecho, aún en casa). */
const ALOJADAS_STATUS = 'INGRESADA';

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(value) {
  const iso = toDateInputValue(value);
  if (!iso) return '—';
  return iso.split('-').reverse().join('/');
}

function formatDisplayDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function paymentCodeLabel(pago) {
  return pago?.codigo || (pago?.id != null ? `Nº ${pago.id}` : '—');
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
  const sectionParam = searchParams.get('section');

  const [activeSection, setActiveSection] = useState(
    SECTIONS[sectionParam] ? sectionParam : SECTIONS.cuentas
  );
  const [reservationsWithBalances, setReservationsWithBalances] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  const [statusFilters, setStatusFilters] = useState(DEFAULT_STATUS_FILTERS);
  const [scopeFilter, setScopeFilter] = useState('alojadas'); // alojadas | todas
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (SECTIONS[sectionParam] && sectionParam !== activeSection) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam, activeSection]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [balancesData, paymentsData] = await Promise.all([
        getReservationsWithBalances(),
        getAllPagos().catch(() => []),
      ]);
      setReservationsWithBalances(balancesData || []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (err) {
      console.error('Error cargando datos:', err);
      const detail = (err?.message || '').replace(
        /^Error fetching reservations with balances:?\s*/,
        ''
      );
      setError(detail ? `Error al cargar los datos (${detail})` : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const selectSection = (section) => {
    setActiveSection(section);
    const next = new URLSearchParams(searchParams);
    next.set('section', section);
    setSearchParams(next, { replace: true });
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(Number(price) || 0);

  const toggleStatus = (status) => {
    setStatusFilters((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const filteredAccounts = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);
    const clientId = clientIdParam ? Number(clientIdParam) : null;

    return (reservationsWithBalances || []).filter((reservation) => {
      const payStatus = reservation.estadoPago || 'PENDIENTE';
      if (!statusFilters[payStatus]) return false;

      if (scopeFilter === 'alojadas' && reservation.status !== ALOJADAS_STATUS) {
        return false;
      }

      if (clientId != null && !Number.isNaN(clientId)) {
        const matchesClient =
          reservation.mainClient?.id === clientId ||
          Number(reservation.mainClientId) === clientId;
        if (!matchesClient) return false;
      }

      if (from || to) {
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
  }, [
    reservationsWithBalances,
    statusFilters,
    scopeFilter,
    dateFrom,
    dateTo,
    clientIdParam,
  ]);

  const filteredPayments = useMemo(() => {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);
    const clientId = clientIdParam ? Number(clientIdParam) : null;

    return (payments || [])
      .filter((pago) => {
        if (clientId != null && !Number.isNaN(clientId)) {
          const matchesClient =
            pago.reserva?.mainClient?.id === clientId ||
            Number(pago.reserva?.mainClientId) === clientId;
          if (!matchesClient) return false;
        }
        if (from || to) {
          const refDate = pago.fecha ? new Date(pago.fecha) : null;
          if (!refDate || Number.isNaN(refDate.getTime())) return false;
          if (from && refDate < from) return false;
          if (to && refDate > to) return false;
        }
        return true;
      })
      .slice()
      .sort((a, b) => {
        const da = a.fecha ? new Date(a.fecha).getTime() : 0;
        const db = b.fecha ? new Date(b.fecha).getTime() : 0;
        if (db !== da) return db - da;
        return Number(b.id) - Number(a.id);
      });
  }, [payments, dateFrom, dateTo, clientIdParam]);

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
    <div className={styles.newLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Estado de cuentas</h2>
        </div>
        <nav className={styles.sectionMenu} aria-label="Secciones de estado de cuentas">
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.cuentas ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.cuentas)}
          >
            Cuentas pendientes
          </button>
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.pagos ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.pagos)}
          >
            Pagos
          </button>
        </nav>
      </aside>

      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>
          {activeSection === SECTIONS.cuentas && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Cuentas pendientes</h2>
              </div>

              <div className={styles.filters} aria-label="Filtros de cuentas">
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>Alcance</span>
                  <label className={styles.check}>
                    <input
                      type="radio"
                      name="scope"
                      checked={scopeFilter === 'alojadas'}
                      onChange={() => setScopeFilter('alojadas')}
                    />
                    Alojadas ahora
                  </label>
                  <label className={styles.check}>
                    <input
                      type="radio"
                      name="scope"
                      checked={scopeFilter === 'todas'}
                      onChange={() => setScopeFilter('todas')}
                    />
                    Todas
                  </label>
                </div>

                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>Saldo</span>
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
                    Pagados
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
                    <input
                      type="date"
                      aria-label="Fecha desde"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label className={styles.dateField}>
                    <input
                      type="date"
                      aria-label="Fecha hasta"
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
              </div>

              <div className={styles.panelHeader}>
                <h3>
                  {filteredAccounts.length} resultado
                  {filteredAccounts.length === 1 ? '' : 's'}
                </h3>
              </div>

              {filteredAccounts.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No hay cuentas con los filtros actuales</p>
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Reserva</th>
                        <th>Estado</th>
                        <th>Códigos</th>
                        <th>Cliente</th>
                        <th>Cargos</th>
                        <th>Pagado</th>
                        <th>Saldo</th>
                        <th>Saldo estado</th>
                        <th>Último mov.</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((reservation) => {
                        const client = reservation.mainClient;
                        const clientName = client
                          ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                          : 'Sin cliente';
                        const statusColor =
                          STATUS_COLORS[reservation.estadoPago] || '#6b7280';
                        const paymentList = (reservation.pagos || [])
                          .slice()
                          .sort((a, b) => Number(a.id) - Number(b.id));
                        const lastPaymentDate =
                          paymentList.length > 0
                            ? paymentList.reduce((latest, pago) => {
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
                            <td className={styles.metaCell}>{reservation.status || '—'}</td>
                            <td>
                              {paymentList.length > 0 ? (
                                <div
                                  className={styles.paymentIdList}
                                  title="Códigos de pago para papelitos"
                                >
                                  {paymentList.map((pago) => (
                                    <span key={pago.id} className={styles.paymentId}>
                                      {paymentCodeLabel(pago)}
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
                                ? formatDisplayDate(lastMove)
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
          )}

          {activeSection === SECTIONS.pagos && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Pagos</h2>
              </div>

              <div className={styles.filters} aria-label="Filtros de pagos">
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>Fechas</span>
                  <label className={styles.dateField}>
                    <input
                      type="date"
                      aria-label="Fecha desde"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label className={styles.dateField}>
                    <input
                      type="date"
                      aria-label="Fecha hasta"
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
              </div>

              <div className={styles.panelHeader}>
                <h3>
                  {filteredPayments.length} pago
                  {filteredPayments.length === 1 ? '' : 's'}
                </h3>
              </div>

              {filteredPayments.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No hay pagos con los filtros actuales</p>
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Fecha</th>
                        <th>Reserva</th>
                        <th>Cliente</th>
                        <th>Monto</th>
                        <th>Método</th>
                        <th>Referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((pago) => {
                        const client = pago.reserva?.mainClient;
                        const clientName = client
                          ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                          : 'Sin cliente';
                        const amount =
                          pago.montoARS != null ? pago.montoARS : pago.monto;

                        return (
                          <tr key={pago.id} className={styles.row}>
                            <td className={styles.idCell}>{paymentCodeLabel(pago)}</td>
                            <td className={styles.metaCell}>
                              {formatDisplayDateTime(pago.fecha)}
                            </td>
                            <td className={styles.idCell}>
                              #{pago.reservaId || pago.reserva?.id || '—'}
                            </td>
                            <td>
                              {client?.id ? (
                                <button
                                  type="button"
                                  className={styles.linkButton}
                                  onClick={() => handleClientClick(client)}
                                  title="Ver cliente"
                                >
                                  {clientName || 'Sin cliente'}
                                </button>
                              ) : (
                                <span>{clientName || 'Sin cliente'}</span>
                              )}
                            </td>
                            <td className={styles.amountCell}>{formatPrice(amount)}</td>
                            <td className={styles.metaCell}>{pago.metodo || '—'}</td>
                            <td className={styles.metaCell}>
                              {pago.referencia || pago.empresa || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

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
