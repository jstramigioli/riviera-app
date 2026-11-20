import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import styles from './NotificationModal.module.css';

const NotificationModal = ({ isOpen, onClose, title, message, type = 'success' }) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="presentation">
      <div
        className={`${styles.modal} ${styles[type] || styles.info}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-modal-title"
      >
        <div className={styles.header}>
          <h3 id="notice-modal-title" className={styles.title}>
            {title}
          </h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className={styles.content}>
          <p className={styles.message}>{message}</p>
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.confirmButton} onClick={onClose}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
