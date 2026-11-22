import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotifications,
  markNotificationRead,
  resolveNotification,
  syncNotifications,
  unresolveNotification
} from '../services/notificationsApi';
import styles from './ReceptionDashboard.module.css';

const TYPE_LABELS = {
  PENDING_ARRIVAL: 'Ingreso',
  LATE_CHECKOUT: 'Checkout',
  GUEST_BIRTHDAY: 'Cumpleaños'
};

function linkPath(notification) {
  if (notification.linkType === 'RESERVATION' && notification.linkId) {
    return `/reservations/${notification.linkId}`;
  }
  if (notification.linkType === 'CLIENT' && notification.linkId) {
    return `/clients/${notification.linkId}`;
  }
  if (notification.linkType === 'ROOM' && notification.linkId) {
    return `/habitaciones/${notification.linkId}`;
  }
  return null;
}

/**
 * Panel de notificaciones persistidas.
 * Al cargar (y al cambiar la fecha simulada) sincroniza cumpleaños del día.
 * Leer ≠ resolver.
 */
export default function NotificationsPanel({ todayIso }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvedFilter, setResolvedFilter] = useState('open');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (todayIso) {
        await syncNotifications(todayIso).catch(() => null);
      }
      const data = await fetchNotifications({
        resolved: resolvedFilter,
        read: 'all',
        limit: 100
      });
      setItems(data.data || []);
    } catch (err) {
      setError(err?.message || 'Error al cargar notificaciones');
    } finally {
      setLoading(false);
    }
  }, [todayIso, resolvedFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openItem = async (notification) => {
    const path = linkPath(notification);
    setBusyId(notification.id);
    try {
      if (!notification.isRead) {
        const updated = await markNotificationRead(notification.id);
        setItems((prev) =>
          prev.map((n) => (n.id === notification.id ? updated : n))
        );
      }
    } catch {
      /* seguir al link aunque falle el read */
    } finally {
      setBusyId(null);
    }
    if (path) navigate(path);
  };

  const onResolve = async (notification) => {
    setBusyId(notification.id);
    try {
      const updated = notification.isResolved
        ? await unresolveNotification(notification.id)
        : await resolveNotification(notification.id);
      if (resolvedFilter === 'open' && updated.isResolved) {
        setItems((prev) => prev.filter((n) => n.id !== notification.id));
      } else if (resolvedFilter === 'resolved' && !updated.isResolved) {
        setItems((prev) => prev.filter((n) => n.id !== notification.id));
      } else {
        setItems((prev) =>
          prev.map((n) => (n.id === notification.id ? updated : n))
        );
      }
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className={`${styles.module} ${styles.tileNotifs}`}
      aria-labelledby="dash-notif"
    >
      <div className={styles.moduleHeader}>
        <h2 id="dash-notif" className={styles.moduleTitle}>
          Notificaciones
        </h2>
        <div className={styles.moduleToolbar}>
          <select
            className={styles.dateInput}
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
            aria-label="Filtro resueltas"
          >
            <option value="open">Abiertas</option>
            <option value="resolved">Resueltas</option>
            <option value="all">Todas</option>
          </select>
          <button type="button" className={styles.actionBtn} onClick={load}>
            Actualizar
          </button>
        </div>
      </div>

      {error ? (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={styles.empty}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Sin notificaciones.</p>
      ) : (
        <ul className={styles.notifList}>
          {items.map((n) => (
            <li
              key={n.id}
              className={`${styles.notifItem} ${n.isRead ? '' : styles.notifUnread}`}
            >
              <div className={styles.notifMain}>
                <div className={styles.notifTitle}>
                  <span
                    className={`${styles.badge} ${
                      n.severity === 'WARNING' || n.severity === 'DANGER'
                        ? styles.badgeWarn
                        : ''
                    }`}
                  >
                    {TYPE_LABELS[n.type] || n.type}
                  </span>
                  {n.title}
                  {!n.isRead ? (
                    <span className={styles.badge}>Nueva</span>
                  ) : null}
                  {n.isResolved ? (
                    <span className={styles.statusMuted}> · resuelta</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`${styles.listLink} ${styles.notifBody}`}
                  onClick={() => openItem(n)}
                  disabled={busyId === n.id}
                >
                  {n.body || 'Ver ítem'}
                </button>
              </div>
              <div className={styles.notifActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  disabled={busyId === n.id}
                  onClick={() => onResolve(n)}
                >
                  {n.isResolved ? 'Reabrir' : 'Resolver'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
