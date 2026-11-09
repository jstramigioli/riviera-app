import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/TariffDashboard.module.css';

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className={styles.cardContent}>
      <h3 className={styles.cardTitle}>Acciones rápidas</h3>
      
      <div className={styles.actionsList}>
        <button 
          className={styles.actionButton}
          onClick={() => navigate('/configuracion?tab=cargos-tarifas')}
        >
          <span className={styles.actionIcon}>💰</span>
          <div className={styles.actionContent}>
            <span className={styles.actionTitle}>Gestionar tarifas</span>
            <span className={styles.actionDescription}>
              CRUD de bloques de temporada (fuente de verdad)
            </span>
          </div>
        </button>

        <button 
          className={styles.actionButton}
          onClick={() => navigate('/consultas-reservas')}
        >
          <span className={styles.actionIcon}>🔎</span>
          <div className={styles.actionContent}>
            <span className={styles.actionTitle}>Cotizar en Consulta</span>
            <span className={styles.actionDescription}>
              Usa el mismo motor canónico que esta configuración
            </span>
          </div>
        </button>

        <button 
          className={styles.actionButton}
          onClick={() => navigate('/precios-inteligentes')}
        >
          <span className={styles.actionIcon}>🧪</span>
          <div className={styles.actionContent}>
            <span className={styles.actionTitle}>Precios inteligentes (experimental)</span>
            <span className={styles.actionDescription}>
              No afectan cotización ni reservas todavía
            </span>
          </div>
        </button>
      </div>

      <div className={styles.cardFooter}>
        <small className={styles.helpText}>
          Las tarifas se gestionan en Configuración → Cargos y Tarifas. Moneda: ARS.
        </small>
      </div>
    </div>
  );
}
