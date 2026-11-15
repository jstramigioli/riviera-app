import { ROLES } from '../auth/roles';
import ReceptionDashboard from './ReceptionDashboard';
import PlaceholderRoleDashboard from './PlaceholderRoleDashboard';

/**
 * Registro multi-rol de dashboards.
 * Solo RECEPCION tiene implementación completa; el resto es placeholder
 * hasta que se definan sus módulos.
 */
export const DASHBOARD_BY_ROLE = {
  [ROLES.RECEPCION]: ReceptionDashboard,
  [ROLES.ADMIN]: ReceptionDashboard,
  [ROLES.PROPIETARIO]: ReceptionDashboard,
  [ROLES.GERENCIA]: ReceptionDashboard,
  [ROLES.CAMARERO]: PlaceholderRoleDashboard,
  [ROLES.COCINA]: PlaceholderRoleDashboard,
  [ROLES.MUCAMA]: PlaceholderRoleDashboard,
  [ROLES.MANTENIMIENTO]: PlaceholderRoleDashboard
};

export function resolveDashboardComponent(role) {
  return DASHBOARD_BY_ROLE[role] || PlaceholderRoleDashboard;
}

/** Roles que pueden previsualizarse desde Admin (incluye futuros). */
export const PREVIEWABLE_DASHBOARD_ROLES = [
  ROLES.RECEPCION,
  ROLES.ADMIN,
  ROLES.PROPIETARIO,
  ROLES.GERENCIA,
  ROLES.CAMARERO,
  ROLES.COCINA,
  ROLES.MUCAMA,
  ROLES.MANTENIMIENTO
];
