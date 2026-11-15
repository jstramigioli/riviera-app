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
export default function FakeReservationsDebugFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const [selected, setSelected] = useState(() => new Set(['arrival_today', 'depart_today']));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [lastBatchId, setLastBatchId] = useState(null);
  const rootRef = useRef(null);
  const panelId = useId();

  const isAdmin = user?.role === ROLES.ADMIN;

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const meta = await fetchFakeReservationsMeta();
        if (cancelled) return;
        setEnabled(true);
        setScenarios(meta.scenarios || Object.keys(SCENARIO_LABELS));
      } catch {
        if (!cancelled) setEnabled(false);
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

  if (!isAdmin || !enabled) return null;

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
    reuseClient: true,
    nightAmount: 50000,
    nights: 2
  });

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
            Hoy operativo: <strong>{todayIsoLocal()}</strong>. Marcador en notes:
            DEBUG batch=…
          </p>

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
              disabled={busy}
              onClick={() => onGenerate({ pack: 'recepcion' })}
            >
              Pack recepción
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy}
              onClick={() => onGenerate({ pack: 'hotel_almost_full' })}
            >
              Casi lleno
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy}
              onClick={() => onGenerate({ pack: 'hotel_full' })}
            >
              Hotel lleno
            </button>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy}
              onClick={onPreview}
            >
              Preview
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || selected.size === 0}
              onClick={() => onGenerate()}
            >
              Generar
            </button>
          </div>

          <div className={localStyles.cleanRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy || !lastBatchId}
              onClick={onCleanBatch}
            >
              Limpiar lote
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy}
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
