import React from 'react';
import styles from '../styles/FloatingAddButton.module.css';

export default function FloatingAddButton({ onClick }) {
  return (
    <button 
      className={styles.floatingButton}
      onClick={onClick}
      aria-label="Nueva consulta"
      title="Nueva consulta"
    >
      <span className={styles.plusIcon}>+</span>
    </button>
  );
} 