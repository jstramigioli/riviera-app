import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiArrowDown, FiArrowUp, FiCheck, FiX } from 'react-icons/fi';
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
import {
  updateReservationOnServer,
  updateReservationStatusOnServer
} from '../utils/apiUtils';
import FloatingActionButton from '../components/FloatingActionButton';
import ConsumptionOrderModal from '../components/ConsumptionOrderModal';
import CobroForm from '../components/CobroForm';
import ReservationIdChip from '../components/ReservationIdChip';
import RoomNameChip from '../components/RoomNameChip';
import ReservationStatusPlain from '../components/ReservationStatusPlain';
import GuestCheckInStatusCell from '../components/GuestCheckInStatusCell';
import NotificationsPanel from './NotificationsPanel';
import ComidasHub from './ComidasHub';
import CajaWidget from './CajaWidget';
import { formatMoneyArs } from '../utils/formatMoney';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import styles from './ReceptionDashboard.module.css';

const NOTES_PLACEHOLDER = 'Agregar notas…';

const RANGE_OPTIONS = [
  { days: 1, label: 'Hoy' },
  { days: 2, label: 'Mañana' },
  { days: 3, label: '3 días' },
  { days: 7, label: '7 días' }
];

function formatSaldo(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return formatMoneyArs(n, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function isSettledBalance(row) {
  if (!row) return null;
  if (row.estadoCobro === 'PAGADO' || row.estadoCobro === 'A_FAVOR') return true;
  const saldo = Number(row.saldo);
  if (Number.isFinite(saldo)) return saldo <= 0;
  return null;
}

function pendingSaldoAmount(row) {
  if (!row || isSettledBalance(row) !== false) return null;
  const saldo = Number(row.saldo);
  return Number.isFinite(saldo) && saldo > 0 ? saldo : null;
}

/** Crédito a saldar (absoluto) cuando hay saldo a favor (saldo < 0). */
export function creditSaldoAmount(row) {
  if (!row) return null;
  const saldo = Number(row.saldo);
  if (!Number.isFinite(saldo) || saldo >= 0) return null;
  return Math.abs(saldo);
}

function civilLocalDate(dayIso) {
  const [y, m, d] = String(dayIso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDayTitle(dayIso) {
  const raw = format(civilLocalDate(dayIso), "EEEE d 'de' MMMM", { locale: es });
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

function RangeFilter({ value, onChange, labelledBy }) {
  return (
    <div className={styles.rangeGroup} role="group" aria-labelledby={labelledBy}>
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.days}
          type="button"
          className={`${styles.rangeBtn} ${
            value === opt.days ? styles.rangeBtnActive : ''
          }`}
          aria-pressed={value === opt.days}
          onClick={() => onChange(opt.days)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function displayNotes(notes) {
  const text = String(notes || '').trim();
  return text || null;
}

function NotesEditDialog({
  open,
  guestName,
  initialNotes,
  saving,
  error,
  onClose,
  onSave
}) {
  const [draft, setDraft] = useState(initialNotes || '');
  const textareaRef = useRef(null);
  const overlayDismiss = useOverlayDismiss(onClose, { enabled: !saving });

  useEffect(() => {
    if (!open) return undefined;
    setDraft(initialNotes || '');
    const t = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, initialNotes]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.notesOverlay}
      role="presentation"
      {...overlayDismiss}
    >
      <div
        className={styles.notesDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-notes-title"
      >
        <header className={styles.notesDialogHeader}>
          <h3 id="dash-notes-title" className={styles.notesDialogTitle}>
            Notas{guestName ? ` · ${guestName}` : ''}
          </h3>
          <button
            type="button"
            className={styles.notesCloseBtn}
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
          >
            <FiX aria-hidden="true" />
          </button>
        </header>
        <div className={styles.notesDialogBody}>
          <label className={styles.srOnly} htmlFor="dash-notes-textarea">
            Notas de la reserva
          </label>
          <textarea
            id="dash-notes-textarea"
            ref={textareaRef}
            className={styles.notesTextarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={NOTES_PLACEHOLDER}
            rows={5}
            disabled={saving}
          />
          {error ? (
            <p className={styles.inlineError} role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className={styles.notesDialogFooter}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.actionBtnPrimary}
            disabled={saving}
            onClick={() => onSave(draft)}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Dashboard operativo de recepción.
 * Fecha operativa = todayIsoLocal(); hub + sin botón Hoy (solo en Libro).
 */
export default function ReceptionDashboard() {
  const navigate = useNavigate();
  const [todayIso, setTodayIso] = useState(() => todayIsoLocal());
  const [mealsDateIso, setMealsDateIso] = useState(() => todayIsoLocal());
  const [horizonDays, setHorizonDays] = useState(1);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentReservaId, setPaymentReservaId] = useState(null);
  const [paymentMontoASaldar, setPaymentMontoASaldar] = useState(null);
  const [paymentInitialMode, setPaymentInitialMode] = useState(null);
  const [paymentInitialMonto, setPaymentInitialMonto] = useState(null);
  const [cajaRefreshToken, setCajaRefreshToken] = useState(0);
  const [balancesByReservationId, setBalancesByReservationId] = useState(
    () => new Map()
  );
  const [notesEditor, setNotesEditor] = useState(null);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState(null);
  /** Estado pre-check-in por reserva, para deshacer «ingresada» al mismo valor. */
  const preCheckInStatusByIdRef = useRef(new Map());

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
        serviceTypes,
        horizonDays
      }),
    [todayIso, mealsDateIso, rooms, reservations, serviceTypes, horizonDays]
  );

  const openReservation = (reservationId) => {
    if (reservationId == null) return;
    navigate(`/reservations/${reservationId}`);
  };

  const openInternalGuestCheckIn = (reservationId) => {
    if (reservationId == null) return;
    navigate(`/reservations/${reservationId}`, {
      state: { activeTab: 'huespedes', openGuestForm: true }
    });
  };

  const reservationById = useMemo(() => {
    const map = new Map();
    for (const r of reservations || []) {
      if (r?.id != null) map.set(Number(r.id), r);
    }
    return map;
  }, [reservations]);

  const openClient = (clientId) => {
    if (clientId == null) return;
    navigate(`/clients/${clientId}`);
  };

  const resetPaymentState = () => {
    setPaymentOpen(false);
    setPaymentReservaId(null);
    setPaymentMontoASaldar(null);
    setPaymentInitialMode(null);
    setPaymentInitialMonto(null);
  };

  const openPaymentForSaldo = (reservationId, saldo) => {
    if (reservationId == null || !(Number(saldo) > 0)) return;
    setPaymentReservaId(reservationId);
    setPaymentMontoASaldar(Number(saldo));
    setPaymentInitialMode(null);
    setPaymentInitialMonto(null);
    setPaymentOpen(true);
  };

  const openDevolucionForCredit = (reservationId, monto) => {
    if (reservationId == null || !(Number(monto) > 0)) return;
    setPaymentReservaId(reservationId);
    // Favor = crédito de cuenta → Monto a saldar; al elegir origen con desc. baja lo a devolver.
    setPaymentMontoASaldar(Number(monto));
    setPaymentInitialMode('devolucion');
    setPaymentInitialMonto(null);
    setPaymentOpen(true);
  };

  const openNotesEditor = (item) => {
    if (item?.reservationId == null) return;
    setNotesError(null);
    setNotesEditor({
      reservationId: item.reservationId,
      guestName: item.guestName || item.label || '',
      notes: displayNotes(item.notes) || ''
    });
  };

  const closeNotesEditor = () => {
    if (notesSaving) return;
    setNotesEditor(null);
    setNotesError(null);
  };

  const saveNotes = async (draft) => {
    if (!notesEditor?.reservationId) return;
    const nextNotes = String(draft || '').trim();
    setNotesSaving(true);
    setNotesError(null);
    try {
      await updateReservationOnServer(
        notesEditor.reservationId,
        { notes: nextNotes || null },
        setReservations
      );
      setNotesEditor(null);
    } catch (err) {
      setNotesError(err?.message || 'No se pudieron guardar las notas');
    } finally {
      setNotesSaving(false);
    }
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

  /** Toggle check-in: INGRESADA ↔ estado previo (fallback CONFIRMADA). */
  const toggleCheckIn = (item) => {
    if (!item?.reservationId) return;
    if (item.status === 'INGRESADA') {
      const previous =
        preCheckInStatusByIdRef.current.get(item.reservationId) || 'CONFIRMADA';
      preCheckInStatusByIdRef.current.delete(item.reservationId);
      setStatus(item.reservationId, previous);
      return;
    }
    if (item.pending) {
      if (item.status) {
        preCheckInStatusByIdRef.current.set(item.reservationId, item.status);
      }
      setStatus(item.reservationId, 'INGRESADA');
    }
  };

  const checkoutRows = model.today?.checkOutItems || [];
  const checkInRows = model.today?.checkInItems || [];

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

  const { meals } = model;
  const dayTitle = formatDayTitle(todayIso);

  const renderSaldoCell = (reservationId) => {
    const bal = balancesByReservationId.get(Number(reservationId));
    const pending = pendingSaldoAmount(bal);
    if (pending != null) {
      return (
        <button
          type="button"
          className={styles.saldoBtn}
          onClick={() => openPaymentForSaldo(reservationId, pending)}
          title="Registrar cobro del saldo pendiente"
        >
          {formatSaldo(pending)}
        </button>
      );
    }
    const credit = creditSaldoAmount(bal);
    if (credit != null) {
      return (
        <button
          type="button"
          className={`${styles.saldoBtn} ${styles.saldoBtnFavor}`}
          onClick={() => openDevolucionForCredit(reservationId, credit)}
          title="Registrar devolución del saldo a favor"
          data-testid="saldo-a-favor"
        >
          {formatSaldo(credit)} (a favor)
        </button>
      );
    }
    return <span className={styles.statusMuted}>—</span>;
  };

  const renderNotesCell = (item) => {
    const text = displayNotes(item.notes);
    return (
      <button
        type="button"
        className={`${styles.notesBtn} ${text ? '' : styles.notesBtnEmpty}`}
        onClick={() => openNotesEditor(item)}
        title={text ? 'Editar notas' : 'Agregar notas'}
      >
        {text || NOTES_PLACEHOLDER}
      </button>
    );
  };

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

      <div className={styles.masonry} data-testid="reception-masonry">
        <div className={styles.masonryColMain}>
        <section
          className={`${styles.module} ${styles.tileMovements}`}
          aria-labelledby="dash-movements"
        >
          <div className={styles.moduleHeader}>
            <h2 id="dash-movements" className={styles.moduleTitle}>
              Movimientos
            </h2>
            <div className={styles.moduleToolbar}>
              <RangeFilter
                value={horizonDays}
                onChange={setHorizonDays}
                labelledBy="dash-movements"
              />
            </div>
          </div>

          <div className={styles.movementsSplit}>
            <div className={styles.movementPane} aria-labelledby="dash-checkin">
              <h3 id="dash-checkin" className={styles.movementPaneTitle}>
                <span className={styles.movementIcon} aria-hidden="true">
                  <FiArrowDown />
                </span>
                Ingresos
              </h3>
              {checkInRows.length === 0 ? (
                <p className={styles.empty}>Sin ingresos pendientes.</p>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={`${styles.dataTable} ${styles.dataTableIn}`}>
                    <thead>
                      <tr>
                        <th className={styles.colReserva}>Nº reserva</th>
                        <th className={styles.colName}>Nombre</th>
                        <th className={styles.colGuests}>Huéspedes</th>
                        <th className={styles.colRoom}>Habitación</th>
                        <th className={styles.colService}>Tipo de servicio</th>
                        <th className={styles.colNotes}>Notas</th>
                        <th className={styles.colSaldo}>Saldo</th>
                        <th className={styles.colStatus}>Estado</th>
                        <th className={styles.colGuestCheckIn}>Check-in</th>
                        <th className={styles.checkCol}>
                          <span className={styles.srOnly}>Marcar ingreso</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkInRows.map((item) => {
                        const canCheckIn = Boolean(item.pending);
                        const reservation =
                          reservationById.get(Number(item.reservationId)) || {
                            id: item.reservationId,
                            guests: [],
                            onlineCheckIns: []
                          };
                        return (
                          <tr key={`in-${item.reservationId}`}>
                            <td className={styles.colReserva}>
                              <ReservationIdChip
                                id={item.reservationId}
                                source={item.source}
                                status={item.status}
                                onClick={() => openReservation(item.reservationId)}
                                title="Ver reserva"
                              />
                            </td>
                            <td className={styles.colName}>
                              <button
                                type="button"
                                className={styles.listLink}
                                onClick={() =>
                                  item.clientId != null
                                    ? openClient(item.clientId)
                                    : openReservation(item.reservationId)
                                }
                                title={
                                  item.clientId != null
                                    ? 'Ver cliente'
                                    : 'Ver reserva'
                                }
                              >
                                {item.guestName || item.label}
                              </button>
                              {item.overdue ? (
                                <span className={styles.lateHint}>
                                  {' '}
                                  atrasado ({item.plannedCheckIn})
                                </span>
                              ) : item.plannedCheckIn &&
                                item.plannedCheckIn !== todayIso ? (
                                <span className={styles.statusMuted}>
                                  {' '}
                                  · {item.plannedCheckIn}
                                </span>
                              ) : null}
                            </td>
                            <td className={styles.colGuests}>
                              {item.guests ?? '—'}
                            </td>
                            <td className={styles.colRoom}>
                              <RoomNameChip
                                name={item.roomLabel}
                                rooms={item.rooms}
                              />
                            </td>
                            <td className={styles.colService}>
                              <span className={styles.cellClamp}>
                                {item.serviceTypeLabel || '—'}
                              </span>
                            </td>
                            <td className={styles.colNotes}>
                              {renderNotesCell(item)}
                            </td>
                            <td className={styles.colSaldo}>
                              {renderSaldoCell(item.reservationId)}
                            </td>
                            <td className={styles.colStatus}>
                              <ReservationStatusPlain status={item.status} />
                            </td>
                            <td className={styles.colGuestCheckIn}>
                              <GuestCheckInStatusCell
                                reservation={reservation}
                                onOpenInternalForm={() =>
                                  openInternalGuestCheckIn(item.reservationId)
                                }
                              />
                            </td>
                            <td className={styles.checkCol}>
                              {canCheckIn ? (
                                <button
                                  type="button"
                                  className={`${styles.checkInBtn} ${styles.checkInBtnIdle}`}
                                  disabled={statusBusyId === item.reservationId}
                                  aria-label={`Marcar ingreso de ${item.guestName || 'reserva'}`}
                                  title="Marcar como ingresada"
                                  aria-pressed="false"
                                  onClick={() => toggleCheckIn(item)}
                                >
                                  <FiCheck aria-hidden="true" />
                                </button>
                              ) : item.status === 'INGRESADA' ? (
                                <button
                                  type="button"
                                  className={`${styles.checkInBtn} ${styles.checkInBtnDone}`}
                                  disabled={statusBusyId === item.reservationId}
                                  aria-label={`Desmarcar ingreso de ${item.guestName || 'reserva'}`}
                                  title="Ingresada (clic para desmarcar)"
                                  aria-pressed="true"
                                  onClick={() => toggleCheckIn(item)}
                                >
                                  <FiCheck aria-hidden="true" />
                                </button>
                              ) : (
                                <span className={styles.statusMuted}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={styles.movementPane} aria-labelledby="dash-checkout">
              <h3 id="dash-checkout" className={styles.movementPaneTitle}>
                <span className={styles.movementIcon} aria-hidden="true">
                  <FiArrowUp />
                </span>
                Egresos
              </h3>
              {checkoutRows.length === 0 ? (
                <p className={styles.empty}>Sin egresos.</p>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={`${styles.dataTable} ${styles.dataTableOut}`}>
                    <thead>
                      <tr>
                        <th className={styles.colReserva}>Nº reserva</th>
                        <th className={styles.colName}>Nombre</th>
                        <th className={styles.colGuests}>Huéspedes</th>
                        <th className={styles.colRoom}>Habitación</th>
                        <th className={styles.colNotes}>Notas</th>
                        <th className={styles.colSaldo}>Saldo</th>
                        <th className={styles.colStatus}>Estado</th>
                        <th className={styles.colActions}>
                          <span className={styles.srOnly}>Acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkoutRows.map((item) => (
                        <tr key={`out-${item.reservationId}`}>
                          <td className={styles.colReserva}>
                            <ReservationIdChip
                              id={item.reservationId}
                              source={item.source}
                              status={item.status}
                              onClick={() => openReservation(item.reservationId)}
                              title="Ver reserva"
                            />
                          </td>
                          <td className={styles.colName}>
                            <button
                              type="button"
                              className={styles.listLink}
                              onClick={() =>
                                item.clientId != null
                                  ? openClient(item.clientId)
                                  : openReservation(item.reservationId)
                              }
                              title={
                                item.clientId != null
                                  ? 'Ver cliente'
                                  : 'Ver reserva'
                              }
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
                          <td className={styles.colGuests}>
                            {item.guests ?? '—'}
                          </td>
                          <td className={styles.colRoom}>
                            <RoomNameChip
                              name={item.roomLabel}
                              rooms={item.rooms}
                            />
                          </td>
                          <td className={styles.colNotes}>
                            {renderNotesCell(item)}
                          </td>
                          <td className={styles.colSaldo}>
                            {renderSaldoCell(item.reservationId)}
                          </td>
                          <td className={styles.colStatus}>
                            <ReservationStatusPlain status={item.status} />
                          </td>
                          <td className={styles.colActions}>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              disabled={statusBusyId === item.reservationId}
                              onClick={() =>
                                setStatus(item.reservationId, 'FINALIZADA')
                              }
                            >
                              Finalizar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        <CajaWidget todayIso={todayIso} refreshToken={cajaRefreshToken} />
        </div>

        <div className={styles.masonryColSide}>
        <ComidasHub
          mealsDateIso={mealsDateIso}
          onMealsDateChange={setMealsDateIso}
          meals={meals}
          onOpenReservation={openReservation}
          onOpenClient={openClient}
        />

        <NotificationsPanel todayIso={todayIso} />
        </div>
      </div>

      <FloatingActionButton
        onCreateQuery={() => navigate('/consulta')}
        onCreateReservation={() => navigate('/consulta?modo=reserva')}
        onCreateConsumption={() => setConsumptionOpen(true)}
        onCreatePayment={() => {
          setPaymentReservaId(null);
          setPaymentMontoASaldar(null);
          setPaymentInitialMode(null);
          setPaymentInitialMonto(null);
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
        <CobroForm
          reservaId={paymentReservaId}
          initialMontoASaldar={paymentMontoASaldar}
          initialMode={paymentInitialMode}
          initialMonto={paymentInitialMonto}
          onClose={resetPaymentState}
          onSuccess={() => {
            resetPaymentState();
            setCajaRefreshToken((n) => n + 1);
            load({ quiet: true });
          }}
        />
      ) : null}

      <NotesEditDialog
        open={Boolean(notesEditor)}
        guestName={notesEditor?.guestName}
        initialNotes={notesEditor?.notes || ''}
        saving={notesSaving}
        error={notesError}
        onClose={closeNotesEditor}
        onSave={saveNotes}
      />
    </div>
  );
}
