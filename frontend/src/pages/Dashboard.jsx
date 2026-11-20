import { ROLES } from '../auth/roles';
import { useAuth } from '../contexts/AuthContext';
import { resolveDashboardComponent } from '../dashboards/registry';

/**
 * Shell multi-rol del dashboard.
 * Resuelve el componente según el rol efectivo de sesión (incluye simulación debug).
 */
export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || ROLES.RECEPCION;
  const DashboardView = resolveDashboardComponent(role);

  return <DashboardView role={role} />;
}
