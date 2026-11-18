import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  subscribeSimulatedToday,
  todayIsoLocal
} from '../utils/calendarDates';
import { buildReceptionDashboardModel } from '../utils/receptionDashboardStats';
import {
  fetchRooms,
  fetchReservations,
  fetchServiceTypes,
  getReservationsWithBalances
} from '../services/api';
import { updateReservationStatusOnServer } from '../utils/apiUtils';
import FloatingActionButton from '../components/FloatingActionButton';
import ConsumptionOrderModal from '../components/ConsumptionOrderModal';
import PaymentForm from '../components/PaymentForm';
import NotificationsPanel from './NotificationsPanel';
import ComidasHub from './ComidasHub';
import styles from './ReceptionDashboard.module.css';

function formatSaldo(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n);
}

function isSettledBalance(row) {
  if (!row) return null;
  if (row.estadoPago === 'PAGADO' || row.estadoPago === 'A_FAVOR') return true;
  const saldo = Number(row.saldo);
  if (Number.isFinite(saldo)) return saldo <= 0;
  return null;
}

function civilLocalDate(dayIso) {
  const [y, m, d] = String(dayIso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDayTitle(dayIso) {
  const raw = format(civilLocalDate(dayIso), "EEEE d 'de' MMMM", { locale: es });
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

/**
 * Dashboard operativo de recepción.
 * Hoy = todayIsoLocal(); acciones rápidas = mismo FloatingActionButton del Libro.
 */
export default function ReceptionDashboard() {
  const navigate = useNavigate();
  const [todayIso, setTodayIso] = useState(() => todayIsoLocal());
  const [mealsDateIso, setMealsDateIso] = useState(() => todayIsoLocal());
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentReservaId, setPaymentReservaId] = useState(null);
  const [balancesByReservationId, setBalancesByReservationId] = useState(
    () => new Map()
  );

  useEffect(() => {
    return subscribeSimulatedToday(() => {
      const next = todayIsoLocal();
      setTodayIso((prevToday) => {
        setMealsDateIso((mealsPrev) => (mealsPrev === prevToday ? next : mealsPrev));
        return next;
      });
    });
  }, []);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const [roomsData, reservationsData, servicePayload, balances] =
        await Promise.all([
          fetchRooms(),
          fetchReservations(),
          fetchServiceTypes().catch(() => []),
          getReservationsWithBalances().catch(() => [])
        ]);
      setRooms(roomsData || []);
      setReservations(reservationsData || []);
      setServiceTypes(Array.isArray(servicePayload) ? servicePayload : []);
      const map = new Map();
      for (const row of balances || []) {
        if (row?.id != null) map.set(Number(row.id), row);
      }
      setBalancesByReservationId(map);
    } catch (err) {
      setError(err?.message || 'Error al cargar el dashboard');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const model = useMemo(
    () =>
      buildReceptionDashboardModel({
        todayIso,
        mealsDateIso,
        rooms,
        reservations,
        serviceTypes
      }),
    [todayIso, mealsDateIso, rooms, reservations, serviceTypes]
  );

  const openReservation = (reservationId) => {
    if (reservationId == null) return;
    navigate(`/reservations/${reservationId}`);
  };

  const setStatus = async (reservationId, newStatus) => {
    if (reservationId == null || statusBusyId != null) return;
    setStatusBusyId(reservationId);
    try {
      await updateReservationStatusOnServer(
        reservationId,
        newStatus,
        setReservations
      );
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar el estado');
      await load({ quiet: true });
    } finally {
      setStatusBusyId(null);
    }
  };

  const checkoutRows = model.today?.checkOutItems || [];

  if (loading) {
    return <div className={styles.loading}>Cargando dashboard…</div>;
  }

  if (error && !model.today) {
    return (
      <div className={styles.errorBox}>
        <p>{error}</p>
        <button type="button" className={styles.retryBtn} onClick={() => load()}>
          Reintentar
        </button>
      </div>
    );
  }

  const { today, meals } = model;
  const dayTitle = formatDayTitle(todayIso);

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <h1 className={styles.pageTitle}>{dayTitle}</h1>
      </header>

      {error ? (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.grid}>
        <section className={styles.module} aria-labelledby="dash-checkin">
          <h2 id="dash-checkin" className={styles.moduleTitle}>
            <span
              className={`${styles.timelineDot} ${styles.timelineDotCheckin}`}
              aria-hidden="true"
            />
            Ingresos
          </h2>
          {today.checkInItems.length === 0 ? (
            <p className={styles.empty}>Sin ingresos pendientes.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Huéspedes</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {today.checkInItems.map((item) => (
                  <tr key={`in-${item.reservationId}`}>
                    <td>
                      <button
                        type="button"
                        className={styles.listLink}
                        onClick={() => openReservation(item.reservationId)}
                      >
                        {item.guestName || item.label}
                      </button>
                      {item.overdue ? (
                        <span className={styles.lateHint}>
                          {' '}
                          atrasado ({item.plannedCheckIn})
                        </span>
                      ) : null}
                    </td>
                    <td>{item.guests ?? '—'}</td>
                    <td>
                      {item.pending ? (
                        <button
                          type="button"
                          className={styles.statusBtn}
                          disabled={statusBusyId === item.reservationId}
                          onClick={() => setStatus(item.reservationId, 'INGRESADA')}
                        >
                          Pendiente
                        </button>
                      ) : item.status === 'INGRESADA' ? (
                        <span className={styles.statusDone}>Ingresada</span>
                      ) : (
                        <span className={styles.statusMuted}>{item.status || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.module} aria-labelledby="dash-checkout">
          <h2 id="dash-checkout" className={styles.moduleTitle}>
            <span
              className={`${styles.timelineDot} ${styles.timelineDotCheckout}`}
              aria-hidden="true"
            />
            Egresos
          </h2>
          {checkoutRows.length === 0 ? (
            <p className={styles.empty}>Sin egresos de hoy ni atrasados.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Huéspedes</th>
                  <th>Saldo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {checkoutRows.map((item) => {
                  const bal = balancesByReservationId.get(
                    Number(item.reservationId)
                  );
                  const settled = isSettledBalance(bal);
                  return (
                    <tr key={`out-${item.reservationId}`}>
                      <td>
                        <button
                          type="button"
                          className={styles.listLink}
                          onClick={() => openReservation(item.reservationId)}
                        >
                          {item.guestName || item.label}
                        </button>
                        {item.late ? (
                          <span className={styles.lateHint}>
                            {' '}
                            atrasado ({item.plannedCheckout})
                          </span>
                        ) : item.plannedCheckout ? (
                          <span className={styles.statusMuted}>
                            {' '}
                            · {item.plannedCheckout}
                          </span>
                        ) : null}
                      </td>
                      <td>{item.guests ?? '—'}</td>
                      <td>
                        {settled === true ? (
                          <span className={styles.statusDone}>Saldado</span>
                        ) : settled === false ? (
                          <span className={styles.lateHint}>
                            No saldado · {formatSaldo(bal?.saldo)}
                          </span>
                        ) : (
                          <span className={styles.statusMuted}>Sin folio</span>
                        )}
                      </td>
                      <td className={styles.actionsCell}>
                        {settled === false ? (
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => {
                              setPaymentReservaId(item.reservationId);
                              setPaymentOpen(true);
                            }}
                          >
                            Agregar pagos
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={styles.actionBtn}
                          disabled={statusBusyId === item.reservationId}
                          onClick={() =>
                            setStatus(item.reservationId, 'FINALIZADA')
                          }
                        >
                          Finalizar reserva
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <ComidasHub
          mealsDateIso={mealsDateIso}
          onMealsDateChange={setMealsDateIso}
          meals={meals}
          onOpenReservation={openReservation}
        />

        <NotificationsPanel todayIso={todayIso} />
      </div>

      <FloatingActionButton
        onToday={() => navigate('/libro-de-reservas')}
        onCreateQuery={() => navigate('/consulta')}
        onCreateReservation={() => navigate('/consulta?modo=reserva')}
        onCreateConsumption={() => setConsumptionOpen(true)}
        onCreatePayment={() => {
          setPaymentReservaId(null);
          setPaymentOpen(true);
        }}
      />

      <ConsumptionOrderModal
        open={consumptionOpen}
        preset={null}
        onClose={() => setConsumptionOpen(false)}
        onSaved={() => {
          setConsumptionOpen(false);
          load({ quiet: true });
        }}
      />
      {paymentOpen ? (
        <PaymentForm
          reservaId={paymentReservaId}
          onClose={() => {
            setPaymentOpen(false);
            setPaymentReservaId(null);
          }}
          onSuccess={() => {
            setPaymentOpen(false);
            setPaymentReservaId(null);
            load({ quiet: true });
          }}
        />
      ) : null}
    </div>
  );
}
