import React from 'react';
import { FiX } from 'react-icons/fi';
import styles from './SeasonBlockModal.module.css';

export default function SeasonBlockModal({ isOpen, onClose, block }) {
  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2>{block ? 'Editar Bloque de Temporada' : 'Nuevo Bloque de Temporada'}</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
          >
            <FiX />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          <div className={styles.comingSoon}>
            <div className={styles.comingSoonIcon}>🚧</div>
            <h3>Modal en Desarrollo</h3>
            <p>
              El modal completo para crear y editar bloques de temporada está en desarrollo.
              Incluirá formularios para fechas, precios base por habitación y ajustes por servicio.
            </p>
            <div className={styles.features}>
              <h4>Funcionalidades a implementar:</h4>
              <ul>
                <li>✅ Selector de fechas de inicio y fin</li>
                <li>✅ Tabla de tarifas base por tipo de habitación</li>
                <li>✅ Tabla de ajustes por servicio (modo fijo/porcentaje)</li>
                <li>✅ Validaciones de fechas y solapamientos</li>
                <li>✅ Integración con la API backend</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button
            className={styles.closeModalButton}
            onClick={handleClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
} 