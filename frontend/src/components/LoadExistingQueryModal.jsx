import React from 'react';
import styles from './LoadExistingQueryModal.module.css';

const LoadExistingQueryModal = ({ 
  isOpen, 
  onClose, 
  onLoadQuery, 
  onContinueWithoutLoading,
  existingQuery 
}) => {
  if (!isOpen) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLoadQuery = () => {
    onLoadQuery(existingQuery);
    onClose();
  };

  const handleContinueWithoutLoading = () => {
    onContinueWithoutLoading();
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>📋 Consulta Preexistente</h3>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.icon}>⚠️</div>
          
          <p className={styles.message}>
            Este cliente ya tiene una consulta guardada que fue modificada por última vez el:
          </p>
          
          <div className={styles.queryInfo}>
            <strong>{formatDate(existingQuery?.updatedAt)}</strong>
          </div>
          
          <p className={styles.question}>
            ¿Deseas cargar los datos de esa consulta o continuar con los datos actuales?
          </p>
        </div>
        
        <div className={styles.actions}>
          <button 
            className={styles.secondaryButton}
            onClick={handleContinueWithoutLoading}
          >
            Continuar con datos actuales
          </button>
          
          <button 
            className={styles.primaryButton}
            onClick={handleLoadQuery}
          >
            Cargar consulta existente
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadExistingQueryModal;

