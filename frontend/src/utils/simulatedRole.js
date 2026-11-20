import { ROLES } from '../auth/roles';
import { PREVIEWABLE_DASHBOARD_ROLES } from '../dashboards/registry';

/** localStorage: rol simulado de debug (solo Admin real lo aplica en Auth). */
export const SIMULATED_ROLE_STORAGE_KEY = 'riviera.debug.simulatedRole';
export const SIMULATED_ROLE_EVENT = 'riviera:simulated-role';

export const SIMULATABLE_ROLES = PREVIEWABLE_DASHBOARD_ROLES;

function isKnownRole(role) {
  return SIMULATABLE_ROLES.includes(role) || Object.values(ROLES).includes(role);
}

export function getSimulatedRole() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SIMULATED_ROLE_STORAGE_KEY);
    if (raw && isKnownRole(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function isSimulatedRoleActive() {
  return Boolean(getSimulatedRole());
}

function emitSimulatedRoleChange() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(SIMULATED_ROLE_EVENT, { detail: getSimulatedRole() })
    );
  } catch {
    /* ignore */
  }
}

/** null/'' → desactiva y vuelve al rol real de sesión. */
export function setSimulatedRole(roleOrNull) {
  try {
    if (typeof localStorage === 'undefined') return getSimulatedRole();
    if (!roleOrNull || !isKnownRole(roleOrNull)) {
      localStorage.removeItem(SIMULATED_ROLE_STORAGE_KEY);
    } else {
      localStorage.setItem(SIMULATED_ROLE_STORAGE_KEY, roleOrNull);
    }
  } catch {
    /* ignore */
  }
  emitSimulatedRoleChange();
  return getSimulatedRole();
}

export function clearSimulatedRole() {
  return setSimulatedRole(null);
}

/** Suscripción a cambios de simulación (misma pestaña + storage). */
export function subscribeSimulatedRole(onChange) {
  if (typeof window === 'undefined') return () => {};
  const notify = () => onChange(getSimulatedRole());
  const onCustom = () => notify();
  const onStorage = (e) => {
    if (e.key === SIMULATED_ROLE_STORAGE_KEY || e.key === null) notify();
  };
  window.addEventListener(SIMULATED_ROLE_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SIMULATED_ROLE_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
