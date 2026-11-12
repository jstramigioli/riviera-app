import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { getReservationsWithBalances, getAllPagos } from '../services/api';
import PaymentForm from '../components/PaymentForm';
import styles from './CobrosPagos.module.css';

const SECTIONS = {
  pendientes: 'pendientes',
  historial: 'historial',
  caja: 'caja',
};

const STATUS_COLORS = {
  PENDIENTE: '#e03131',
  PAGADO: '#2f9e44',
  A_FAVOR: '#f59f00',
};

const CobrosPagos = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const clientIdParam = searchParams.get('clientId');

  const [activeSection, setActiveSection] = useState(
    SECTIONS[sectionParam] ? sectionParam : SECTIONS.pendientes
  );
  const [reservationsWithBalances, setReservationsWithBalances] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (SECTIONS[sectionParam] && sectionParam !== activeSection) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [balancesData, paymentsData] = await Promise.all([
        getReservationsWithBalances(),
        getAllPagos().catch(() => []),
      ]);

      setReservationsWithBalances(balancesData || []);
      setPayments(paymentsData || []);
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

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectSection = (section) => {
    setActiveSection(section);
    const next = new URLSearchParams(searchParams);
    next.set('section', section);
    setSearchParams(next, { replace: true });
  };

  const pendingBalances = useMemo(() => {
    let rows = (reservationsWithBalances || []).filter(
      (reservation) => reservation.estadoPago === 'PENDIENTE'
    );

    if (clientIdParam) {
      const clientId = Number(clientIdParam);
      rows = rows.filter(
        (reservation) =>
          reservation.mainClient?.id === clientId ||
          Number(reservation.mainClientId) === clientId
      );
    }

    return rows;
  }, [reservationsWithBalances, clientIdParam]);

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

  const handlePaymentSuccess = () => {
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
          <h2>Cobros y Pagos</h2>
        </div>

        <nav className={styles.sectionMenu} aria-label="Secciones de cobros">
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.pendientes ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.pendientes)}
          >
            Saldos pendientes
          </button>
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.historial ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.historial)}
          >
            Historial de pagos
          </button>
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.caja ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.caja)}
          >
            Caja diaria
          </button>
        </nav>
      </aside>

      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>
          {activeSection === SECTIONS.pendientes && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Saldos pendientes</h2>
                {clientIdParam && (
                  <button
                    type="button"
                    className={styles.clearFilterButton}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.delete('clientId');
                      setSearchParams(next, { replace: true });
                    }}
                  >
                    Quitar filtro de cliente
                  </button>
                )}
              </div>

              {pendingBalances.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No hay saldos pendientes</p>
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Reserva</th>
                        <th>Cliente</th>
                        <th>Cargos</th>
                        <th>Pagos</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingBalances.map((reservation) => {
                        const client = reservation.mainClient;
                        const clientName = client
                          ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                          : 'Sin cliente';
                        const statusColor =
                          STATUS_COLORS[reservation.estadoPago] || '#6b7280';

                        return (
                          <tr key={reservation.id} className={styles.row}>
                            <td className={styles.idCell}>#{reservation.id}</td>
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

          {activeSection === SECTIONS.historial && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Historial de pagos</h2>
              </div>

              {payments.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No hay pagos registrados</p>
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Reserva</th>
                        <th>Cliente</th>
                        <th>Método</th>
                        <th>Monto</th>
                        <th>ARS</th>
                        <th>Referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((pago) => {
                        const client = pago.reserva?.mainClient;
                        const clientName = client
                          ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                          : 'Sin cliente';
                        const montoLabel =
                          pago.moneda === 'USD'
                            ? `USD ${Number(pago.monto).toLocaleString('es-AR')}`
                            : formatPrice(pago.monto);

                        return (
                          <tr key={pago.id} className={styles.row}>
                            <td>{formatDateTime(pago.fecha)}</td>
                            <td className={styles.idCell}>
                              #{pago.reservaId || pago.reserva?.id || '—'}
                            </td>
                            <td>
                              {client?.id ? (
                                <button
                                  type="button"
                                  className={styles.linkButton}
                                  onClick={() => handleClientClick(client)}
                                >
                                  {clientName}
                                </button>
                              ) : (
                                clientName
                              )}
                            </td>
                            <td>{pago.metodo || '—'}</td>
                            <td>{montoLabel}</td>
                            <td className={styles.amountCell}>
                              {formatPrice(pago.montoARS)}
                            </td>
                            <td className={styles.metaCell}>
                              {pago.referencia || pago.notas || '—'}
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

          {activeSection === SECTIONS.caja && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>Caja diaria</h2>
              </div>
              <div className={styles.placeholder}>
                <h3>Próximamente</h3>
                <p>
                  Esta sección quedará para el cierre de caja del día {formatDate(new Date())}.
                  Por ahora es un espacio preparado, sin movimientos.
                </p>
              </div>
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
    </div>
  );
};

export default CobrosPagos;
