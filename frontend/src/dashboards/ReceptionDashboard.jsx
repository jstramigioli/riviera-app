import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  subscribeSimulatedToday,
  todayIsoLocal
} from '../utils/calendarDates';
import { buildReceptionDashboardModel } from '../utils/receptionDashboardStats';
import { fetchRooms, fetchReservations, fetchServiceTypes } from '../services/api';
import { updateReservationStatusOnServer } from '../utils/apiUtils';
import FloatingActionButton from '../components/FloatingActionButton';
import ConsumptionOrderModal from '../components/ConsumptionOrderModal';
import PaymentForm from '../components/PaymentForm';
import NotificationsPanel from './NotificationsPanel';
import styles from './ReceptionDashboard.module.css';

function civilLocalDate(dayIso) {
  const [y, m, d] = String(dayIso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDayTitle(dayIso) {
  const raw = format(civilLocalDate(dayIso), "EEEE d 'de' MMMM", { locale: es });
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

function printMealRows(title, rows) {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.guestName || r.label || '—')}</td><td>${escapeHtml(String(r.roomLabel || '—'))}</td><td>${escapeHtml(String(r.guests ?? ''))}</td></tr>`
    )
    .join('');
  const html = `<!doctype html><html><head><title>${escapeHtml(title)}</title>
<style>
  body{font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;color:#1f2933;padding:24px}
  h1{font-size:16px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #d8dde6}
  th{font-size:12px;color:#6b7280}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<table><thead><tr><th>Nombre</th><th>Habitación</th><th>Huéspedes</th></tr></thead>
<tbody>${body || '<tr><td colspan="3">Sin filas seleccionadas</td></tr>'}</tbody></table>
</body></html>`;
  const win = window.open('', '_blank', 'noopener,noreferrer,width=720,height=640');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const [selectedBreakfast, setSelectedBreakfast] = useState(() => new Set());
  const [selectedDinner, setSelectedDinner] = useState(() => new Set());
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

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
      const [roomsData, reservationsData, servicePayload] = await Promise.all([
        fetchRooms(),
        fetchReservations(),
        fetchServiceTypes().catch(() => [])
      ]);
      setRooms(roomsData || []);
      setReservations(reservationsData || []);
      setServiceTypes(Array.isArray(servicePayload) ? servicePayload : []);
    } catch (err) {
      setError(err?.message || 'Error al cargar el dashboard');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setSelectedBreakfast(new Set());
    setSelectedDinner(new Set());
  }, [mealsDateIso]);

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

  const toggleMealSelection = (meal, reservationId) => {
    const setter = meal === 'breakfast' ? setSelectedBreakfast : setSelectedDinner;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(reservationId)) next.delete(reservationId);
      else next.add(reservationId);
      return next;
    });
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
            <p className={styles.empty}>Sin egresos pendientes de finalizar.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Huéspedes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {checkoutRows.map((item) => (
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
                    <td className={styles.actionsCell}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        disabled={statusBusyId === item.reservationId}
                        onClick={() => setStatus(item.reservationId, 'FINALIZADA')}
                      >
                        Finalizar reserva
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.module} aria-labelledby="dash-breakfast">
          <div className={styles.mealHeader}>
            <h2 id="dash-breakfast" className={styles.moduleTitle}>
              Desayuno
            </h2>
            <div className={styles.mealsToolbar}>
              <input
                id="dash-meals-date-b"
                type="date"
                className={styles.dateInput}
                value={mealsDateIso}
                onChange={(e) => {
                  if (e.target.value) setMealsDateIso(e.target.value);
                }}
                aria-label="Fecha desayuno"
              />
              <button
                type="button"
                className={styles.actionBtn}
                disabled={selectedBreakfast.size === 0}
                onClick={() =>
                  printMealRows(
                    `Desayuno · ${mealsDateIso}`,
                    (meals.breakfastItems || []).filter((r) =>
                      selectedBreakfast.has(r.reservationId)
                    )
                  )
                }
              >
                Imprimir detalle
              </button>
            </div>
          </div>
          {meals.breakfastItems.length === 0 ? (
            <p className={styles.empty}>Sin desayunos.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th className={styles.checkCol} />
                  <th>Nombre</th>
                  <th>Habitación</th>
                  <th>Huéspedes</th>
                </tr>
              </thead>
              <tbody>
                {meals.breakfastItems.map((item) => (
                  <tr key={`bf-${item.reservationId}`}>
                    <td className={styles.checkCol}>
                      <input
                        type="checkbox"
                        checked={selectedBreakfast.has(item.reservationId)}
                        onChange={() =>
                          toggleMealSelection('breakfast', item.reservationId)
                        }
                        aria-label={`Seleccionar ${item.guestName}`}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.listLink}
                        onClick={() => openReservation(item.reservationId)}
                      >
                        {item.guestName}
                      </button>
                    </td>
                    <td>{item.roomLabel || '—'}</td>
                    <td>{item.guests ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.module} aria-labelledby="dash-dinner">
          <div className={styles.mealHeader}>
            <h2 id="dash-dinner" className={styles.moduleTitle}>
              Cena
            </h2>
            <div className={styles.mealsToolbar}>
              <input
                id="dash-meals-date-d"
                type="date"
                className={styles.dateInput}
                value={mealsDateIso}
                onChange={(e) => {
                  if (e.target.value) setMealsDateIso(e.target.value);
                }}
                aria-label="Fecha cena"
              />
              <button
                type="button"
                className={styles.actionBtn}
                disabled={selectedDinner.size === 0}
                onClick={() =>
                  printMealRows(
                    `Cena · ${mealsDateIso}`,
                    (meals.dinnerItems || []).filter((r) =>
                      selectedDinner.has(r.reservationId)
                    )
                  )
                }
              >
                Imprimir detalle
              </button>
            </div>
          </div>
          {meals.dinnerItems.length === 0 ? (
            <p className={styles.empty}>Sin cenas.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th className={styles.checkCol} />
                  <th>Nombre</th>
                  <th>Habitación</th>
                  <th>Huéspedes</th>
                </tr>
              </thead>
              <tbody>
                {meals.dinnerItems.map((item) => (
                  <tr key={`dn-${item.reservationId}`}>
                    <td className={styles.checkCol}>
                      <input
                        type="checkbox"
                        checked={selectedDinner.has(item.reservationId)}
                        onChange={() =>
                          toggleMealSelection('dinner', item.reservationId)
                        }
                        aria-label={`Seleccionar ${item.guestName}`}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.listLink}
                        onClick={() => openReservation(item.reservationId)}
                      >
                        {item.guestName}
                      </button>
                    </td>
                    <td>{item.roomLabel || '—'}</td>
                    <td>{item.guests ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <NotificationsPanel todayIso={todayIso} />
      </div>

      <FloatingActionButton
        onToday={() => navigate('/libro-de-reservas')}
        onCreateQuery={() => navigate('/consulta')}
        onCreateReservation={() => navigate('/consulta?modo=reserva')}
        onCreateConsumption={() => setConsumptionOpen(true)}
        onCreatePayment={() => setPaymentOpen(true)}
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
          reservaId={null}
          onClose={() => setPaymentOpen(false)}
          onSuccess={() => {
            setPaymentOpen(false);
            load({ quiet: true });
          }}
        />
      ) : null}
    </div>
  );
}
