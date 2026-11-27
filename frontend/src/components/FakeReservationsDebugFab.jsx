import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../auth/roles';
import { todayIsoLocal } from '../utils/calendarDates';
import {
  deleteAllFakeReservations,
  deleteFakeReservationBatch,
  fetchFakeReservationsMeta,
  generateFakeReservations,
  previewFakeReservations
} from '../services/debugFakeReservationsApi';
import styles from './SimulatedTodayDebugFab.module.css';
import localStyles from './FakeReservationsDebugFab.module.css';

const SCENARIO_LABELS = {
  arrival_today: 'Ingreso hoy',
  arrival_late: 'Ingreso atrasado',
  stay_active: 'En casa',
  depart_today: 'Egreso hoy',
  depart_late: 'Egreso atrasado',
  finished: 'Finalizada',
  cancelled: 'Cancelada'
};

/**
 * Debug ADMIN: generar/limpiar reservas ficticias (notes DEBUG batch=…).
 */
function defaultRange() {
  const today = todayIsoLocal();
  const [y, m, d] = today.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1, d));
  end.setUTCDate(end.getUTCDate() + 7);
  return { from: today, to: end.toISOString().slice(0, 10) };
}

export default function FakeReservationsDebugFab() {
  const { realUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [gateError, setGateError] = useState('');
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState(() => new Set(['arrival_today', 'depart_today']));
  const [range, setRange] = useState(defaultRange);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [lastBatchId, setLastBatchId] = useState(null);
  const rootRef = useRef(null);
  const panelId = useId();

  /** Rol real de sesión: el FAB sigue disponible aunque se simule otro rol. */
  const isAdmin = realUser?.role === ROLES.ADMIN;

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetchFakeReservationsMeta();
        if (cancelled) return;
        setApiReady(true);
        setGateError('');
        setScenarios(meta.scenarios || Object.keys(SCENARIO_LABELS));
      } catch (err) {
        if (!cancelled) {
          setApiReady(false);
          setGateError(
            err?.message ||
              'API debug no disponible (ENABLE_DEBUG_FAKE_RESERVATIONS / reiniciar backend)'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  /** FAB visible para ADMIN aunque meta falle; el panel avisa si la API está off. */
  if (!isAdmin) return null;

  const toggleScenario = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const bodyBase = () => ({
    today: todayIsoLocal(),
    from: range.from,
    to: range.to,
    reuseClient: true,
    nightAmount: 50000
  });

  const rangeInvalid = !range.from || !range.to || range.to <= range.from;

  const run = async (fn) => {
    setBusy(true);
    setMessage('');
    try {
      const result = await fn();
      return result;
    } catch (err) {
      setMessage(err?.message || 'Error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const onPreview = async () => {
    const result = await run(() =>
      previewFakeReservations({
        ...bodyBase(),
        scenarios: [...selected]
      })
    );
    if (!result) return;
    const ok = (result.planned || []).filter((p) => !p.skipped).length;
    const skip = (result.planned || []).filter((p) => p.skipped).length;
    setMessage(`Preview: ${ok} a crear, ${skip} omitidas · hab. servicio ${result.roomsInService}`);
  };

  const onGenerate = async (extra = {}) => {
    const result = await run(() =>
      generateFakeReservations({
        ...bodyBase(),
        scenarios: extra.pack ? undefined : [...selected],
        ...extra
      })
    );
    if (!result) return;
    setLastBatchId(result.batchId);
    const ok = (result.created || []).filter((p) => !p.skipped).length;
    setMessage(`OK lote ${result.batchId.slice(0, 8)}… · ${ok} reservas`);
  };

  const onCleanBatch = async () => {
    if (!lastBatchId) {
      setMessage('No hay lote reciente en esta sesión');
      return;
    }
    const result = await run(() => deleteFakeReservationBatch(lastBatchId));
    if (!result) return;
    setMessage(`Limpiado lote: ${result.deletedReservations} reservas`);
    setLastBatchId(null);
  };

  const onCleanAll = async () => {
    if (!window.confirm('¿Borrar TODAS las reservas con notes DEBUG batch=…?')) {
      return;
    }
    const result = await run(() => deleteAllFakeReservations());
    if (!result) return;
    setMessage(`Limpiado DEBUG: ${result.deletedReservations} reservas`);
    setLastBatchId(null);
  };

  return (
    <div className={`${styles.root} ${localStyles.offset}`} ref={rootRef}>
      {open ? (
        <div
          className={`${styles.panel} ${localStyles.widePanel}`}
          id={panelId}
          role="dialog"
          aria-label="Reservas ficticias debug"
        >
          <p className={styles.title}>Reservas ficticias</p>
          <p className={styles.hint}>
            Hoy operativo: <strong>{todayIsoLocal()}</strong>. Estancias dentro del
            rango. Marcador: DEBUG batch=…
          </p>
          {!apiReady && gateError ? (
            <p className={styles.status} role="alert">
              {gateError}
            </p>
          ) : null}

          <div className={localStyles.rangeRow}>
            <label className={styles.field} htmlFor="fake-from">
              <span className={styles.fieldLabel}>Desde</span>
              <input
                id="fake-from"
                type="date"
                className={styles.input}
                value={range.from}
                max={range.to || undefined}
                onChange={(e) =>
                  setRange((prev) => ({ ...prev, from: e.target.value }))
                }
              />
            </label>
            <label className={styles.field} htmlFor="fake-to">
              <span className={styles.fieldLabel}>Hasta</span>
              <input
                id="fake-to"
                type="date"
                className={styles.input}
                value={range.to}
                min={range.from || undefined}
                onChange={(e) =>
                  setRange((prev) => ({ ...prev, to: e.target.value }))
                }
              />
            </label>
          </div>
          {rangeInvalid ? (
            <p className={styles.status}>Hasta debe ser posterior a Desde (≥ 1 noche).</p>
          ) : null}

          <div className={localStyles.scenarioList}>
            {(scenarios.length ? scenarios : Object.keys(SCENARIO_LABELS)).map(
              (key) => (
                <label key={key} className={localStyles.check}>
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggleScenario(key)}
                  />
                  {SCENARIO_LABELS[key] || key}
                </label>
              )
            )}
          </div>

          <div className={localStyles.packRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={!apiReady || busy || rangeInvalid}
              onClick={() => onGenerate({ pack: 'recepcion' })}
            >
              Pack recepción
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={!apiReady || busy || rangeInvalid}
              onClick={() => onGenerate({ pack: 'hotel_almost_full' })}
            >
              Casi lleno
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={!apiReady || busy || rangeInvalid}
              onClick={() => onGenerate({ pack: 'hotel_full' })}
            >
              Hotel lleno
            </button>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={!apiReady || busy || rangeInvalid}
              onClick={onPreview}
            >
              Preview
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!apiReady || busy || rangeInvalid || selected.size === 0}
              onClick={() => onGenerate()}
            >
              Generar
            </button>
          </div>

          <div className={localStyles.cleanRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={!apiReady || busy || !lastBatchId}
              onClick={onCleanBatch}
            >
              Limpiar lote
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={!apiReady || busy}
              onClick={onCleanAll}
            >
              Limpiar todos DEBUG
            </button>
          </div>

          {message ? <p className={styles.status}>{message}</p> : null}
        </div>
      ) : null}

      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title="Debug: reservas ficticias"
        aria-label="Abrir generador de reservas ficticias"
      >
        Fake
      </button>
    </div>
  );
}
