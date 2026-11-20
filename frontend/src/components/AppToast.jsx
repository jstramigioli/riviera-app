import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import styles from './AppToast.module.css';

const DEFAULT_DURATION_MS = 2800;

/**
 * Toast inferior auto-dismiss (sin botón de cierre).
 * Para feedback breve post-acción (p.ej. copiado al portapapeles).
 */
const AppToast = ({
  isOpen,
  message,
  type = 'success',
  duration = DEFAULT_DURATION_MS,
  onClose,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, duration);
    const closeTimer = window.setTimeout(() => {
      onClose?.();
    }, duration + 220);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(closeTimer);
    };
  }, [isOpen, duration, onClose, message, type]);

  if (!isOpen && !visible) return null;

  const Icon =
    type === 'error' || type === 'warning'
      ? FiAlertTriangle
      : type === 'info'
        ? FiInfo
        : FiCheckCircle;

  return (
    <div
      className={`${styles.toast} ${styles[type] || styles.success} ${
        visible ? styles.visible : styles.hidden
      }`}
      role="status"
      aria-live="polite"
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
    </div>
  );
};

export default AppToast;
