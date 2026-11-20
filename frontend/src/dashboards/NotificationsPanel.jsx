import styles from './ReceptionDashboard.module.css';

/**
 * Panel de notificaciones del dashboard.
 * Generación automática desactivada: muestra una notificación de muestra estática.
 */
const SAMPLE_NOTIFICATION = {
  id: 'sample-static',
  type: 'SAMPLE',
  severity: 'INFO',
  title: 'Notificación de muestra',
  body: 'Las notificaciones automáticas están pausadas. Este es un ejemplo estático del panel.',
  isRead: false,
  isResolved: false
};

export default function NotificationsPanel() {
  return (
    <section
      className={`${styles.module} ${styles.tileNotifs}`}
      aria-labelledby="dash-notif"
    >
      <div className={styles.mealHeader}>
        <h2 id="dash-notif" className={styles.moduleTitle}>
          Notificaciones
        </h2>
      </div>

      <ul className={styles.notifList}>
        <li className={`${styles.notifItem} ${styles.notifUnread}`}>
          <div className={styles.notifMain}>
            <div className={styles.notifTitle}>
              <span className={styles.badge}>Muestra</span>
              {SAMPLE_NOTIFICATION.title}
            </div>
            <p className={styles.notifBody}>{SAMPLE_NOTIFICATION.body}</p>
          </div>
        </li>
      </ul>
    </section>
  );
}
