import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ROLES, roleLabel } from '../auth/roles';
import {
  clearSimulatedRole,
  getSimulatedRole,
  setSimulatedRole,
  SIMULATABLE_ROLES,
  subscribeSimulatedRole
} from '../utils/simulatedRole';
import styles from './SimulatedTodayDebugFab.module.css';
import localStyles from './SimulatedRoleDebugFab.module.css';

/**
 * Debug ADMIN: simular sesión con otro rol en toda la app (localStorage).
 * Usa el rol real de sesión para mostrarse aunque la UI esté simulada.
 */
export default function SimulatedRoleDebugFab() {
  const { realUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeRole, setActiveRole] = useState(() => getSimulatedRole());
  const [draft, setDraft] = useState(
    () => getSimulatedRole() || realUser?.role || ROLES.RECEPCION
  );
  const rootRef = useRef(null);
  const panelId = useId();

  const isRealAdmin = realUser?.role === ROLES.ADMIN;

  useEffect(() => {
    return subscribeSimulatedRole((role) => {
      setActiveRole(role);
      setDraft(role || realUser?.role || ROLES.RECEPCION);
    });
  }, [realUser?.role]);

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

  if (!isRealAdmin) return null;

  const apply = () => {
    if (!draft) return;
    if (draft === realUser?.role) {
      clearSimulatedRole();
    } else {
      setSimulatedRole(draft);
    }
    setOpen(false);
  };

  const useReal = () => {
    clearSimulatedRole();
    setOpen(false);
  };

  const simulated = Boolean(activeRole) && activeRole !== realUser?.role;

  return (
    <div className={`${styles.root} ${localStyles.offset}`} ref={rootRef}>
      {open ? (
        <div
          className={styles.panel}
          id={panelId}
          role="dialog"
          aria-label="Rol simulado de debug"
        >
          <p className={styles.title}>Rol simulado</p>
          <p className={styles.hint}>
            Cambia menú, permisos UI y dashboards en toda la app. Se guarda en
            localStorage. La sesión API sigue siendo Admin.
          </p>
          <label className={styles.field} htmlFor="debug-simulated-role">
            <span className={styles.fieldLabel}>Rol</span>
            <select
              id="debug-simulated-role"
              className={styles.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            >
              {SIMULATABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                  {role === realUser?.role ? ' (tu rol)' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.status}>
            {simulated
              ? `Activo: ${roleLabel(activeRole)}`
              : `Rol real: ${roleLabel(realUser?.role)}`}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={useReal}>
              Rol real
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
            ? `Rol simulado: ${roleLabel(activeRole)}`
            : 'Debug: simular rol de sesión'
        }
        aria-label={
          simulated
            ? `Rol simulado activo ${roleLabel(activeRole)}`
            : 'Abrir simulación de rol'
        }
      >
        {simulated ? roleLabel(activeRole).slice(0, 3) : 'Rol'}
      </button>
    </div>
  );
}
