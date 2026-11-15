import { roleLabel } from '../auth/roles';
import { useAuth } from '../contexts/AuthContext';
import {
  PREVIEWABLE_DASHBOARD_ROLES,
  resolveDashboardComponent
} from '../dashboards/registry';
import { useDashboardPreviewRole } from '../dashboards/useDashboardPreviewRole';
import styles from '../dashboards/ReceptionDashboard.module.css';

/**
 * Shell multi-rol del dashboard.
 * Resuelve el componente según rol efectivo; Admin puede previsualizar otros roles.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin, previewRole, setPreviewRole, effectiveRole } =
    useDashboardPreviewRole(user?.role);

  const DashboardView = resolveDashboardComponent(effectiveRole);

  return (
    <>
      {isAdmin ? (
        <div
          className={styles.toolbarMeta}
          style={{
            padding: '10px 20px 0',
            background: '#f4f5f7'
          }}
        >
          Previsualizar como
          <select
            className={styles.previewSelect}
            value={previewRole || user?.role || ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value === user?.role) setPreviewRole(null);
              else setPreviewRole(value);
            }}
            aria-label="Previsualizar dashboard como rol"
          >
            {PREVIEWABLE_DASHBOARD_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
                {role === user?.role ? ' (tu rol)' : ''}
              </option>
            ))}
          </select>
          {previewRole && previewRole !== user?.role ? (
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => setPreviewRole(null)}
            >
              Quitar preview
            </button>
          ) : null}
        </div>
      ) : null}
      <DashboardView role={effectiveRole} />
    </>
  );
}
