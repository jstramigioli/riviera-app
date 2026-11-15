import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  formatDateUi,
  shiftIso,
  subscribeSimulatedToday,
  todayIsoLocal
} from '../utils/calendarDates';
import { buildReceptionDashboardModel } from '../utils/receptionDashboardStats';
import { fetchRooms, fetchReservations, fetchServiceTypes } from '../services/api';
import FloatingActionButton from '../components/FloatingActionButton';
import ConsumptionOrderModal from '../components/ConsumptionOrderModal';
import PaymentForm from '../components/PaymentForm';
import styles from './ReceptionDashboard.module.css';

function civilLocalDate(dayIso) {
  const [y, m, d] = String(dayIso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function OccupancyBar({ label, percentage, detail }) {
  const pct = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
  const display = pct.toFixed(1);
  return (
    <div>
      <div className={styles.occupancyHeader}>
        <span>{label}</span>
        <span>
          {display}%{detail ? ` · ${detail}` : ''}
        </span>
      </div>
      <div
        className={styles.occupancyTrack}
        role="progressbar"
        aria-valuenow={Number(display)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={styles.occupancyFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MovementList({ items, emptyLabel, onOpen, badgeFor }) {
  if (!items?.length) {
    return <p className={styles.empty}>{emptyLabel}</p>;
  }
  return (
    <ul className={styles.list}>
      {items.map((item, idx) => (
        <li key={`${item.reservationId}-${idx}`} className={styles.listItem}>
          <button
            type="button"
            className={styles.listLink}
            onClick={() => onOpen(item.reservationId)}
          >
            {item.label}
          </button>
          {badgeFor?.(item)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Dashboard operativo de recepción (módulos A–G).
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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomsData, reservationsData, servicePayload] = await Promise.all([
        fetchRooms(),
        fetchReservations(),
        fetchServiceTypes().catch(() => ({ data: [] }))
      ]);
      setRooms(roomsData || []);
      setReservations(reservationsData || []);
      setServiceTypes(Array.isArray(servicePayload) ? servicePayload : []);
    } catch (err) {
      setError(err?.message || 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
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

  const todayLabel = format(civilLocalDate(todayIso), "EEEE d 'de' MMMM", {
    locale: es
  });

  if (loading) {
    return <div className={styles.loading}>Cargando dashboard…</div>;
  }

  if (error) {
    return (
      <div className={styles.errorBox}>
        <p>{error}</p>
        <button type="button" className={styles.retryBtn} onClick={load}>
          Reintentar
        </button>
      </div>
    );
  }

  const { today, tomorrow, meals, occupancyByType, notifications } = model;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.pageTitle}>Dashboard · Recepción</h1>
        <div className={styles.toolbarMeta}>
          <span>
            Hoy operativo: <strong>{formatDateUi(todayIso)}</strong>
            {' · '}
            {todayLabel}
          </span>
          {model.outOfServiceCount > 0 ? (
            <span>
              Fuera de servicio: {model.outOfServiceCount} (excluidas de capacidad)
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.grid}>
        {/* A — Ingresos hoy */}
        <section className={styles.module} aria-labelledby="dash-ingresos">
          <h2 id="dash-ingresos" className={styles.moduleTitle}>
            Ingresos hoy
          </h2>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{today.checkIns}</span>
              <span className={styles.statLabel}>Pasajeros</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{today.checkInItems.length}</span>
              <span className={styles.statLabel}>Reservas</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{today.pendingArrivals.length}</span>
              <span className={styles.statLabel}>Pendientes de ingreso</span>
            </div>
          </div>
          <MovementList
            items={today.checkInItems}
            emptyLabel="Sin ingresos previstos hoy."
            onOpen={openReservation}
            badgeFor={(item) =>
              item.pending ? (
                <span className={`${styles.badge} ${styles.badgeWarn}`}>Pendiente</span>
              ) : item.status === 'INGRESADA' ? (
                <span className={styles.badge}>Ingresada</span>
              ) : null
            }
          />
        </section>

        {/* B — Egresos hoy + atrasados */}
        <section className={styles.module} aria-labelledby="dash-egresos">
          <h2 id="dash-egresos" className={styles.moduleTitle}>
            Egresos hoy
          </h2>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{today.checkOuts}</span>
              <span className={styles.statLabel}>Pasajeros</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{today.checkOutItems.length}</span>
              <span className={styles.statLabel}>Previstos</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{today.lateCheckouts.length}</span>
              <span className={styles.statLabel}>Atrasados</span>
            </div>
          </div>
          <p className={styles.moduleHint}>Checkout previsto hoy</p>
          <MovementList
            items={today.checkOutItems}
            emptyLabel="Sin egresos previstos hoy."
            onOpen={openReservation}
          />
          {today.lateCheckouts.length > 0 ? (
            <>
              <p className={styles.moduleHint} style={{ marginTop: 12 }}>
                Atrasados (aún ingresados, checkout previsto &lt; hoy)
              </p>
              <MovementList
                items={today.lateCheckouts}
                emptyLabel=""
                onOpen={openReservation}
                badgeFor={(item) => (
                  <span className={`${styles.badge} ${styles.badgeDanger}`}>
                    {item.daysLate}d
                  </span>
                )}
              />
            </>
          ) : null}
        </section>

        {/* C — Ocupación */}
        <section className={`${styles.module} ${styles.moduleWide}`} aria-labelledby="dash-ocup">
          <h2 id="dash-ocup" className={styles.moduleTitle}>
            Ocupación
          </h2>
          <OccupancyBar
            label="Habitaciones físicas"
            percentage={today.roomOccupancyPercentage}
            detail={`${today.occupiedRooms}/${today.totalRooms}`}
          />
          <OccupancyBar
            label="Pasajeros / capacidad"
            percentage={today.guestOccupancyPercentage}
            detail={`${today.totalGuests}/${today.totalGuestCapacity}`}
          />
          <table className={styles.typeTable}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ocupadas</th>
                <th>Libres</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {occupancyByType.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    Sin habitaciones en servicio.
                  </td>
                </tr>
              ) : (
                occupancyByType.map((row) => (
                  <tr key={row.typeName}>
                    <td>{row.typeName}</td>
                    <td>
                      {row.occupied}/{row.total}
                    </td>
                    <td>{row.free}</td>
                    <td>{row.percentage.toFixed(0)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* D — Comidas */}
        <section className={styles.module} aria-labelledby="dash-comidas">
          <h2 id="dash-comidas" className={styles.moduleTitle}>
            Comidas
          </h2>
          <div className={styles.mealsToolbar}>
            <label htmlFor="dash-meals-date">Fecha</label>
            <input
              id="dash-meals-date"
              type="date"
              className={styles.dateInput}
              value={mealsDateIso}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setMealsDateIso(v);
              }}
            />
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => setMealsDateIso(todayIso)}
            >
              Hoy
            </button>
          </div>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{meals.breakfastGuests}</span>
              <span className={styles.statLabel}>Desayuno</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{meals.dinnerGuests}</span>
              <span className={styles.statLabel}>Cena</span>
            </div>
          </div>
          <div className={styles.mealsSplit}>
            <div>
              <p className={styles.moduleHint}>Detalle desayuno</p>
              <MovementList
                items={meals.breakfastItems}
                emptyLabel="Sin desayunos."
                onOpen={openReservation}
              />
            </div>
            <div>
              <p className={styles.moduleHint}>Detalle cena</p>
              <MovementList
                items={meals.dinnerItems}
                emptyLabel="Sin cenas."
                onOpen={openReservation}
              />
            </div>
          </div>
        </section>

        {/* E — Notificaciones */}
        <section className={styles.module} aria-labelledby="dash-notif">
          <h2 id="dash-notif" className={styles.moduleTitle}>
            Notificaciones
          </h2>
          {notifications.length === 0 ? (
            <p className={styles.empty}>Sin pendientes.</p>
          ) : (
            <div>
              {notifications.map((n) => (
                <div key={n.id} className={styles.notifItem}>
                  <div className={styles.notifTitle}>
                    {n.title}
                    {n.severity === 'warning' ? (
                      <span className={`${styles.badge} ${styles.badgeWarn}`}>Atención</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={`${styles.listLink} ${styles.notifBody}`}
                    onClick={() => openReservation(n.reservationId)}
                  >
                    {n.body}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* F — Mantenimiento placeholder */}
        <section className={styles.module} aria-labelledby="dash-mant">
          <h2 id="dash-mant" className={styles.moduleTitle}>
            Mantenimiento
          </h2>
          <p className={styles.empty}>
            Módulo placeholder. Aquí se listarán órdenes / habitaciones fuera de
            servicio cuando exista el flujo de mantenimiento.
          </p>
          {model.outOfServiceCount > 0 ? (
            <p className={styles.moduleHint}>
              Habitaciones con estado fuera de servicio: {model.outOfServiceCount}
            </p>
          ) : null}
        </section>

        {/* G — Mañana */}
        <section className={`${styles.module} ${styles.moduleWide}`} aria-labelledby="dash-manana">
          <h2 id="dash-manana" className={styles.moduleTitle}>
            Mañana · {formatDateUi(shiftIso(todayIso, 1))}
          </h2>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{tomorrow.checkIns}</span>
              <span className={styles.statLabel}>Ingresos (pax)</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{tomorrow.checkOuts}</span>
              <span className={styles.statLabel}>Egresos (pax)</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {tomorrow.occupiedRooms}/{tomorrow.totalRooms}
              </span>
              <span className={styles.statLabel}>Hab. ocupadas</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{tomorrow.breakfastGuests}</span>
              <span className={styles.statLabel}>Desayuno</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{tomorrow.dinnerGuests}</span>
              <span className={styles.statLabel}>Cena</span>
            </div>
          </div>
        </section>
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
          load();
        }}
      />
      {paymentOpen ? (
        <PaymentForm
          reservaId={null}
          onClose={() => setPaymentOpen(false)}
          onSuccess={() => {
            setPaymentOpen(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
