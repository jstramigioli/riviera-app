import React from 'react';
import { FaHome, FaPlus } from 'react-icons/fa';
import styles from '../ReservationGrid.module.css';

export default function GridControls({ onCenterToday, onCreateReservation }) {
  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <button
          onClick={onCenterToday}
          className={styles.controlButton}
          title="Centrar en hoy"
        >
          <FaHome /> Hoy
        </button>
      </div>

      <div className={styles.controlGroup}>
        <button
          onClick={onCreateReservation}
          className={`${styles.controlButton} ${styles.primaryButton}`}
          title="Crear nueva reserva"
        >
          <FaPlus /> Nueva Reserva
        </button>
      </div>
    </div>
  );
} 