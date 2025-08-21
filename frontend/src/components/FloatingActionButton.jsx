import React, { useState } from 'react';
import styles from '../styles/FloatingActionButton.module.css';

export default function FloatingActionButton({ onCreateReservation, onCreateQuery }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleMainButtonClick = () => {
    console.log('🔘 Botón principal clickeado, isExpanded:', !isExpanded);
    setIsExpanded(!isExpanded);
  };

  const handleCreateReservation = () => {
    console.log('📋 Crear reserva clickeado');
    setIsExpanded(false);
    onCreateReservation();
  };

  const handleCreateQuery = () => {
    console.log('❓ Crear consulta clickeado');
    setIsExpanded(false);
    onCreateQuery();
  };

  console.log('🎯 FloatingActionButton renderizado, isExpanded:', isExpanded);

  return (
    <div className={styles.floatingActionContainer}>
      {/* Botones de acción */}
      <div className={`${styles.actionButtons} ${isExpanded ? styles.expanded : ''}`}>
        <button
          className={`${styles.actionButton} ${styles.queryButton}`}
          onClick={handleCreateQuery}
          title="Crear nueva consulta"
          style={{ 
            backgroundColor: '#f39c12', 
            color: 'white',
            display: isExpanded ? 'flex' : 'none'
          }}
        >
          <span className={styles.actionIcon}>?</span>
          <span className={styles.actionLabel}>Nueva Consulta</span>
        </button>
        
        <button
          className={`${styles.actionButton} ${styles.reservationButton}`}
          onClick={handleCreateReservation}
          title="Crear nueva reserva"
          style={{ 
            backgroundColor: '#27ae60', 
            color: 'white',
            display: isExpanded ? 'flex' : 'none'
          }}
        >
          <span className={styles.actionIcon}>📋</span>
          <span className={styles.actionLabel}>Nueva Reserva</span>
        </button>
      </div>

      {/* Botón principal */}
      <button 
        className={`${styles.mainButton} ${isExpanded ? styles.expanded : ''}`}
        onClick={handleMainButtonClick}
        aria-label="Abrir opciones"
        style={{
          backgroundColor: isExpanded ? '#e74c3c' : '#667eea',
          transform: isExpanded ? 'rotate(45deg)' : 'none'
        }}
      >
        <span className={styles.plusIcon}>+</span>
      </button>
    </div>
  );
} 