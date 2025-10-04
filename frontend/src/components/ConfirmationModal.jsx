import React from 'react';
import styles from '../styles/ConfirmationModal.module.css';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirmar", 
  cancelText = "Cancelar",
  confirmButtonClass = "confirm"
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <p className={styles.modalMessage}>{message}</p>
        </div>
        
        <div className={styles.modalFooter}>
          <button 
            className={`${styles.modalButton} ${styles.cancelButton}`}
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button 
            className={`${styles.modalButton} ${styles[confirmButtonClass]}`}
            onClick={onConfirm}
            style={confirmButtonClass === 'danger' ? {
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none'
            } : {}}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;