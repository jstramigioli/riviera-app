import React from 'react';
import styles from './ConfirmationModal.module.css';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirmar acción', 
  message = '¿Estás seguro de que deseas realizar esta acción?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger' // 'danger', 'warning', 'info'
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: '⚠️',
          confirmButtonClass: styles.dangerButton,
          titleClass: styles.dangerTitle
        };
      case 'warning':
        return {
          icon: '⚠️',
          confirmButtonClass: styles.warningButton,
          titleClass: styles.warningTitle
        };
      case 'info':
        return {
          icon: 'ℹ️',
          confirmButtonClass: styles.infoButton,
          titleClass: styles.infoTitle
        };
      default:
        return {
          icon: '❓',
          confirmButtonClass: styles.defaultButton,
          titleClass: styles.defaultTitle
        };
    }
  };

  const { icon, confirmButtonClass, titleClass } = getTypeStyles();

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <div className={styles.icon}>{icon}</div>
          <h2 className={`${styles.title} ${titleClass}`}>{title}</h2>
        </div>
        
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
        </div>
        
        <div className={styles.footer}>
          <button 
            onClick={handleCancel} 
            className={styles.cancelButton}
          >
            {cancelText}
          </button>
          <button 
            onClick={handleConfirm} 
            className={`${styles.confirmButton} ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal; 