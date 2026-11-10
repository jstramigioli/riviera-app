import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import styles from '../styles/ConfirmationModal.module.css';

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmButtonClass = 'confirm',
  type = 'danger',
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const toneClass =
    styles[confirmButtonClass] ||
    styles[type] ||
    (type === 'danger' ? styles.confirm : styles.default);
  const confirmClass = toneClass || styles.confirm;

  return (
    <div
      className={styles.modalBackdrop}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={styles.modalContainer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className={styles.modalHeader}>
          <h3 id="confirm-modal-title" className={styles.modalTitle}>
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

        <div className={styles.modalBody}>
          {typeof message === 'string' ? (
            <p className={styles.modalMessage}>{message}</p>
          ) : (
            <div className={styles.modalMessage}>{message}</div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={`${styles.modalButton} ${styles.cancelButton}`}
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`${styles.modalButton} ${confirmClass}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
