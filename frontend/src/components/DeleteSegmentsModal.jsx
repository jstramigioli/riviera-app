import React from 'react';
import styles from './DeleteSegmentsModal.module.css';

const DeleteSegmentsModal = ({ 
  isOpen, 
  segmentsToDelete,
  onConfirm, 
  onCancel 
}) => {
  if (!isOpen) return null;

  const segmentCount = segmentsToDelete.length;
  const segmentWord = segmentCount === 1 ? 'segmento' : 'segmentos';

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>⚠️ Eliminar {segmentWord}</h3>
        </div>
        
        <div className={styles.content}>
          <p className={styles.warning}>
            Esta acción eliminará <strong>{segmentCount} {segmentWord}</strong> porque quedaría{segmentCount === 1 ? '' : 'n'} sin duración válida (superposición total).
          </p>
          
          <div className={styles.segmentsList}>
            <strong>Segmento{segmentCount === 1 ? '' : 's'} que se eliminarán:</strong>
            <ul>
              {segmentsToDelete.map((seg, index) => (
                <li key={index}>
                  Segmento {seg.index + 1}: {seg.checkIn} → {seg.checkOut}
                </li>
              ))}
            </ul>
          </div>
          
          <p className={styles.question}>
            ¿Desea continuar con esta acción?
          </p>
        </div>
        
        <div className={styles.actions}>
          <button 
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancelar
          </button>
          
          <button 
            className={styles.confirmButton}
            onClick={onConfirm}
          >
            Sí, eliminar {segmentWord}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteSegmentsModal;


