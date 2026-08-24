import React from 'react';
import styles from './ReservationTabs.module.css';

const ServiciosTab = () => {
  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Servicios / Mantenimiento</h3>
      </div>

      <div className={styles.emptyState}>
        <p>Módulo no incluido en el MVP</p>
        <p className={styles.emptySubtext}>
          Los registros de limpieza y mantenimiento se agregarán en una versión posterior.
          Por ahora usá las notas de la reserva para observaciones operativas.
        </p>
      </div>
    </div>
  );
};

export default ServiciosTab;
