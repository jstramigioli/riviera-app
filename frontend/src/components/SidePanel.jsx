import React from 'react';
import styles from '../styles/SidePanel.module.css';

export default function SidePanel({ open, onClose, title, children, width = 400 }) {
  return (
    <>
      {/* Overlay */}
      <div 
        className={`${styles.overlay} ${open ? styles.open : ''}`} 
        onClick={onClose}
      />
      {/* Panel */}
      <aside 
        className={`${styles.sidePanel} ${open ? styles.open : ''}`}
        style={{ width }}
        aria-hidden={!open}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Cerrar panel">
            &times;
          </button>
        </div>
        <div className={styles.content}>
          {children}
        </div>
      </aside>
    </>
  );
} 