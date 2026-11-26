import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';
import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  cancelDiningReservation,
  fetchDiningAgenda,
  updateDiningReservation
} from '../services/diningApi';
import DiningReservationForm from '../components/DiningReservationForm';
import ReservationIdChip from '../components/ReservationIdChip';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useAppNotice } from '../hooks/useAppNotice';
import { todayIsoLocal } from '../utils/calendarDates';
import styles from './Comedor.module.css';

const SECTIONS = {
  agenda: 'agenda',
  nueva: 'nueva'
};

function shiftDate(iso, days) {
  return format(addDays(parseISO(iso), days), 'yyyy-MM-dd');
}

function formatDayLabel(iso) {
  try {
    return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
  } catch {
    return iso;
  }
}

export default function Comedor() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();

  const sectionParam = searchParams.get('section');
  const activeSection = SECTIONS[sectionParam] ? sectionParam : SECTIONS.agenda;
  const dateParam = searchParams.get('date');
  const dayIso = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : todayIsoLocal();

  const [agenda, setAgenda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const selectSection = (section) => {
    const next = new URLSearchParams(searchParams);
    if (section === SECTIONS.agenda) next.delete('section');
    else next.set('section', section);
    setSearchParams(next, { replace: true });
  };

  const setDay = (iso) => {
    const next = new URLSearchParams(searchParams);
    next.set('date', iso);
    setSearchParams(next, { replace: true });
  };

  const loadAgenda = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDiningAgenda(dayIso, 'CENA');
      setAgenda(data);
    } catch (err) {
      setError(err.message || 'Error al cargar comedor');
      setAgenda(null);
    } finally {
      setLoading(false);
    }
  }, [dayIso]);

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);

  const totals = agenda?.totals || {
    mediaPension: 0,
    additional: 0,
    external: 0,
    total: 0
  };

  const managedRows = useMemo(() => {
    const add = agenda?.additional || [];
    const ext = agenda?.external || [];
    return [...add, ...ext];
  }, [agenda]);

  const cancelledRows = agenda?.cancelled || [];
  const mpRows = agenda?.mediaPension || [];

  function diningRowForEdit(row) {
    const full = (agenda?.diningReservations || []).find(
      (r) => r.id === row.diningReservationId
    );
    if (full) {
      return {
        id: full.id,
        serviceDate: full.serviceDate || dayIso,
        guestCount: full.guestCount,
        notes: full.notes,
        reservationId: full.reservationId,
        accountId: full.accountId,
        client: full.client || null
      };
    }
    return {
      id: row.diningReservationId,
      serviceDate: dayIso,
      guestCount: row.guestCount,
      notes: row.notes,
      reservationId: row.lodgingReservationId,
      accountId: row.accountId,
      client: row.clientId
        ? {
            id: row.clientId,
            firstName: row.clientName || '',
            lastName: ''
          }
        : null
    };
  }

  async function handleCancelRow(row) {
    const id = row.diningReservationId;
    if (!id) return;
    const ok = await confirm({
      title: 'Cancelar reserva de comedor',
      message: `¿Cancelar la reserva #${id}? Quedará en histórico y no computará comensales.`,
      confirmText: 'Cancelar reserva',
      cancelText: 'Volver',
      type: 'danger'
    });
    if (!ok) return;
    try {
      await cancelDiningReservation(id);
      notify({ title: 'Comedor', message: 'Reserva cancelada', type: 'success' });
      loadAgenda();
    } catch (err) {
      notify({ title: 'Error', message: err.message, type: 'error' });
    }
  }

  async function handleQuickGuests(row, nextCount) {
    const id = row.diningReservationId;
    if (!id) return;
    const n = parseInt(nextCount, 10);
    if (!Number.isFinite(n) || n < 1) return;
    try {
      await updateDiningReservation(id, { guestCount: n });
      loadAgenda();
    } catch (err) {
      notify({ title: 'Error', message: err.message, type: 'error' });
    }
  }

  function openReservation(id) {
    if (id == null) return;
    navigate(`/reservations/${id}`);
  }

  function openClient(id) {
    if (id == null) return;
    navigate(`/clients/${id}`);
  }

  return (
    <div className={styles.newLayout} data-testid="comedor-page">
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Comedor</h2>
        </div>
        <nav className={styles.sectionMenu} aria-label="Secciones de comedor">
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.agenda ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.agenda)}
          >
            Agenda
          </button>
          <button
            type="button"
            className={`${styles.sectionButton} ${activeSection === SECTIONS.nueva ? styles.active : ''}`}
            onClick={() => selectSection(SECTIONS.nueva)}
          >
            Nueva reserva
          </button>
        </nav>
      </aside>

      <div className={styles.mainContent}>
        <div className={styles.mainContentBody}>
          {activeSection === SECTIONS.nueva || editing ? (
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>{editing ? `Editar #${editing.diningReservationId || editing.id}` : 'Nueva reserva'}</h2>
              </div>
              <div className={styles.panelBody}>
                <DiningReservationForm
                  mode={editing ? 'edit' : 'create'}
                  initial={editing ? diningRowForEdit(editing) : null}
                  defaultDate={dayIso}
                  onCancel={() => {
                    setEditing(null);
                    selectSection(SECTIONS.agenda);
                  }}
                  onSaved={() => {
                    setEditing(null);
                    selectSection(SECTIONS.agenda);
                    notify({
                      title: 'Comedor',
                      message: 'Reserva guardada',
                      type: 'success'
                    });
                    loadAgenda();
                  }}
                />
              </div>
            </div>
          ) : (
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div className={styles.dateNav}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => setDay(shiftDate(dayIso, -1))}
                    aria-label="Día anterior"
                  >
                    <FiChevronLeft />
                  </button>
                  <div className={styles.dateBlock}>
                    <h2>Cena</h2>
                    <label className={styles.srOnly} htmlFor="comedor-date">
                      Fecha
                    </label>
                    <input
                      id="comedor-date"
                      type="date"
                      value={dayIso}
                      onChange={(e) => {
                        if (e.target.value) setDay(e.target.value);
                      }}
                    />
                    <span className={styles.dateLabel}>{formatDayLabel(dayIso)}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => setDay(shiftDate(dayIso, 1))}
                    aria-label="Día siguiente"
                  >
                    <FiChevronRight />
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => selectSection(SECTIONS.nueva)}
                >
                  <FiPlus aria-hidden />
                  Nueva
                </button>
              </div>

              {loading ? (
                <p className={styles.muted}>Cargando…</p>
              ) : error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : (
                <>
                  <div className={styles.totals} data-testid="comedor-totals">
                    <div className={styles.totalCard}>
                      <span className={styles.totalLabel}>Total</span>
                      <span className={styles.totalValue}>{totals.total}</span>
                    </div>
                    <div className={styles.totalCard}>
                      <span className={styles.totalLabel}>Media pensión</span>
                      <span className={styles.totalValue}>{totals.mediaPension}</span>
                    </div>
                    <div className={styles.totalCard}>
                      <span className={styles.totalLabel}>Adicionales</span>
                      <span className={styles.totalValue}>{totals.additional}</span>
                    </div>
                    <div className={styles.totalCard}>
                      <span className={styles.totalLabel}>Externos</span>
                      <span className={styles.totalValue}>{totals.external}</span>
                    </div>
                  </div>

                  <section className={styles.block}>
                    <h3>Media pensión (automática)</h3>
                    {mpRows.length === 0 ? (
                      <p className={styles.muted}>Sin comensales por media pensión.</p>
                    ) : (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Reserva</th>
                            <th>Cliente</th>
                            <th>Comensales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mpRows.map((row) => (
                            <tr key={`mp-${row.lodgingReservationId}`}>
                              <td>
                                <ReservationIdChip
                                  id={row.lodgingReservationId}
                                  source={row.lodgingSource}
                                  status={row.lodgingReservationStatus}
                                  onClick={() => openReservation(row.lodgingReservationId)}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={styles.linkBtn}
                                  onClick={() => openClient(row.clientId)}
                                >
                                  {row.clientName}
                                </button>
                              </td>
                              <td>{row.guestCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>

                  <section className={styles.block}>
                    <h3>Reservas de comedor</h3>
                    {managedRows.length === 0 ? (
                      <p className={styles.muted}>Sin reservas de comedor confirmadas.</p>
                    ) : (
                      <table className={styles.table} data-testid="comedor-managed-table">
                        <thead>
                          <tr>
                            <th>Origen</th>
                            <th>Cliente</th>
                            <th>Alojamiento</th>
                            <th>Comensales</th>
                            <th>Cuenta</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {managedRows.map((row) => (
                            <tr key={`d-${row.diningReservationId}`}>
                              <td>
                                {row.source === 'additional' ? 'Adicional' : 'Externo'}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={styles.linkBtn}
                                  onClick={() => openClient(row.clientId)}
                                >
                                  {row.clientName}
                                </button>
                              </td>
                              <td>
                                {row.lodgingReservationId ? (
                                  <ReservationIdChip
                                    id={row.lodgingReservationId}
                                    source={row.lodgingSource}
                                    status={row.lodgingReservationStatus}
                                    onClick={() => openReservation(row.lodgingReservationId)}
                                  />
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className={styles.guestInput}
                                  min={1}
                                  defaultValue={row.guestCount}
                                  onBlur={(e) => {
                                    if (Number(e.target.value) !== row.guestCount) {
                                      handleQuickGuests(row, e.target.value);
                                    }
                                  }}
                                  aria-label="Comensales"
                                />
                              </td>
                              <td>{row.accountId != null ? `#${row.accountId}` : '—'}</td>
                              <td className={styles.rowActions}>
                                <button
                                  type="button"
                                  className={styles.linkBtn}
                                  onClick={() => setEditing(row)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className={styles.dangerLink}
                                  onClick={() => handleCancelRow(row)}
                                >
                                  Cancelar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>

                  <section className={styles.block}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => setShowCancelled((v) => !v)}
                    >
                      {showCancelled ? 'Ocultar canceladas' : `Ver canceladas (${cancelledRows.length})`}
                    </button>
                    {showCancelled && cancelledRows.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Cliente</th>
                            <th>Comensales</th>
                            <th>Alojamiento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cancelledRows.map((row) => (
                            <tr key={`c-${row.diningReservationId}`}>
                              <td>{row.clientName}</td>
                              <td>{row.guestCount}</td>
                              <td>
                                {row.lodgingReservationId ? (
                                  <ReservationIdChip
                                    id={row.lodgingReservationId}
                                    onClick={() => openReservation(row.lodgingReservationId)}
                                  />
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {confirmDialog}
      {noticeDialog}
    </div>
  );
}
