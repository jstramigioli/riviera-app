import { useEffect, useId, useRef, useState } from 'react';
import {
  clearSimulatedToday,
  getSimulatedTodayIso,
  realTodayIsoLocal,
  setSimulatedTodayIso,
  subscribeSimulatedToday
} from '../utils/calendarDates';
import styles from './SimulatedTodayDebugFab.module.css';

/**
 * Debug: botón flotante abajo-izquierda para simular “hoy” (localStorage).
 */
export default function SimulatedTodayDebugFab() {
  const [open, setOpen] = useState(false);
  const [activeIso, setActiveIso] = useState(() => getSimulatedTodayIso());
  const [draft, setDraft] = useState(() => getSimulatedTodayIso() || realTodayIsoLocal());
  const rootRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    return subscribeSimulatedToday((iso) => {
      setActiveIso(iso);
      setDraft(iso || realTodayIsoLocal());
    });
  }, []);

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

  const apply = () => {
    if (!draft) return;
    setSimulatedTodayIso(draft);
    setOpen(false);
  };

  const useReal = () => {
    clearSimulatedToday();
    setOpen(false);
  };

  const simulated = Boolean(activeIso);

  return (
    <div className={styles.root} ref={rootRef}>
      {open ? (
        <div
          className={styles.panel}
          id={panelId}
          role="dialog"
          aria-label="Fecha simulada de debug"
        >
          <p className={styles.title}>Fecha simulada</p>
          <p className={styles.hint}>
            Alimenta el «hoy» del Libro y demás flujos civiles. Se guarda en
            localStorage.
          </p>
          <label className={styles.field} htmlFor="debug-simulated-today">
            <span className={styles.fieldLabel}>Día</span>
            <input
              id="debug-simulated-today"
              type="date"
              className={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <p className={styles.status}>
            {simulated
              ? `Activa: ${activeIso}`
              : `Reloj real: ${realTodayIsoLocal()}`}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={useReal}>
              Fecha real
            </button>
            <button type="button" className={styles.primaryBtn} onClick={apply}>
              Simular
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={`${styles.fab} ${simulated ? styles.fabActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={
          simulated
            ? `Hoy simulado: ${activeIso}`
            : 'Debug: simular fecha de hoy'
        }
        aria-label={
          simulated
            ? `Fecha simulada activa ${activeIso}`
            : 'Abrir simulación de fecha'
        }
      >
        {simulated ? activeIso.slice(5) : 'Sim'}
      </button>
    </div>
  );
}
