import React from 'react';
import { FaPlus } from 'react-icons/fa';
import styles from './ReservationTabs.module.css';

const ServiciosTab = ({ reservation }) => {
  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>🧹 Servicios / Mantenimiento</h3>
        <button className={styles.addButton}>
          <FaPlus /> Agregar Registro
        </button>
      </div>

      <div className={styles.emptyState}>
        <p>No hay registros de servicios o mantenimiento</p>
        <p className={styles.emptySubtext}>
          Aquí puedes registrar limpiezas, pedidos de mantenimiento, o notas operativas
        </p>
        <button className={styles.primaryButton}>
          Agregar primer registro
        </button>
      </div>
    </div>
  );
};

export default ServiciosTab;


