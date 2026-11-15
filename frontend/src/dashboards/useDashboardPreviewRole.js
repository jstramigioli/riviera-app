import { useCallback, useEffect, useState } from 'react';
import { ROLES } from '../auth/roles';
import { PREVIEWABLE_DASHBOARD_ROLES } from './registry';

export const DASHBOARD_PREVIEW_ROLE_KEY = 'riviera.dashboard.previewRole';

function readStoredPreviewRole() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(DASHBOARD_PREVIEW_ROLE_KEY);
    if (raw && PREVIEWABLE_DASHBOARD_ROLES.includes(raw)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Admin puede previsualizar el dashboard como otro rol (sessionStorage).
 * Roles no-admin siempre ven su propio rol efectivo.
 */
export function useDashboardPreviewRole(userRole) {
  const isAdmin = userRole === ROLES.ADMIN;
  const [previewRole, setPreviewRoleState] = useState(() =>
    isAdmin ? readStoredPreviewRole() : null
  );

  useEffect(() => {
    if (!isAdmin) {
      setPreviewRoleState(null);
      return;
    }
    setPreviewRoleState(readStoredPreviewRole());
  }, [isAdmin]);

  const setPreviewRole = useCallback(
    (roleOrNull) => {
      if (!isAdmin) return;
      const next =
        roleOrNull && PREVIEWABLE_DASHBOARD_ROLES.includes(roleOrNull)
          ? roleOrNull
          : null;
      try {
        if (typeof sessionStorage !== 'undefined') {
          if (next) sessionStorage.setItem(DASHBOARD_PREVIEW_ROLE_KEY, next);
          else sessionStorage.removeItem(DASHBOARD_PREVIEW_ROLE_KEY);
        }
      } catch {
        /* ignore */
      }
      setPreviewRoleState(next);
    },
    [isAdmin]
  );

  const effectiveRole = isAdmin && previewRole ? previewRole : userRole || ROLES.RECEPCION;

  return {
    isAdmin,
    previewRole,
    setPreviewRole,
    effectiveRole
  };
}
