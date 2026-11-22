import { getStatusColor, getStatusLabel } from '../utils/reservationStatusUtils';
import styles from './ReservationStatusPlain.module.css';

/**
 * Lectura: circulito de color + texto (mismo look que el panel lateral plain).
 */
export default function ReservationStatusPlain({ status, className = '' }) {
  if (!status) {
    return <span className={`${styles.root} ${styles.empty} ${className}`.trim()}>—</span>;
  }
  return (
    <span className={`${styles.root} ${className}`.trim()} title={getStatusLabel(status)}>
      <span
        className={styles.dot}
        style={{ backgroundColor: getStatusColor(status) }}
        aria-hidden
      />
      <span className={styles.label}>{getStatusLabel(status)}</span>
    </span>
  );
}
