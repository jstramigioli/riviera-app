import React from 'react';
import styles from '../styles/FloatingActionButton.module.css';

export default function FloatingActionButton({ onCreateQuery }) {
  const handleCreateQuery = () => {
    console.log('❓ Crear consulta clickeado');
    onCreateQuery();
  };

  return (
    <div className={styles.floatingActionContainer}>
      {/* Botón principal */}
      <button 
        className={styles.mainButton}
        onClick={handleCreateQuery}
        aria-label="Consulta"
        title="Consulta"
        style={{
          backgroundColor: '#667eea'
        }}
      >
        <span className={styles.plusIcon}>+</span>
      </button>
    </div>
  );
} 