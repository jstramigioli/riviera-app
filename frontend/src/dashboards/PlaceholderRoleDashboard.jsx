import { roleLabel } from '../auth/roles';
import styles from './ReceptionDashboard.module.css';

/** Placeholder hasta implementar módulos del rol. */
export default function PlaceholderRoleDashboard({ role }) {
  return (
    <div className={styles.placeholder}>
      <h1 className={styles.pageTitle}>Dashboard · {roleLabel(role) || role}</h1>
      <p className={styles.placeholderText}>
        Vista en preparación. Por ahora solo el dashboard de recepción está
        disponible; elegí otro rol en la previsualización de admin o volvé a
        Recepción.
      </p>
    </div>
  );
}
