import { FiTool, FiCalendar, FiCpu, FiBarChart2 } from 'react-icons/fi';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/TariffDashboard.module.css';

export default function QuickActions() {
  const navigate = useNavigate();

  const handleNavigateToConfig = () => {
    navigate('/configuracion');
  };

  const handleNavigateToSeasonBlocks = () => {
    navigate('/configuracion');
    // Aquí podríamos agregar un parámetro para ir directamente a la sección de bloques
    // Por ahora navegamos a configuración
  };

  const handleNavigateToIntelligentPricing = () => {
    navigate('/configuracion');
    // Aquí podríamos agregar un parámetro para ir directamente a la sección de precios inteligentes
  };

  const handleNavigateToRatesCalendar = () => {
    // Navegar al calendario de tarifas (componente existente)
    navigate('/tarifas/calendario');
  };

  return (
    <div className={styles.cardContent}>
      <h3 className={styles.cardTitle}> Acciones Rápidas</h3>
      
      <div className={styles.actionsList}>
        <button 
          className={styles.actionButton}
          onClick={handleNavigateToConfig}
        >
          <span className={styles.actionIcon} aria-hidden="true"><FiTool /></span>
          <div className={styles.actionContent}>
            <span className={styles.actionTitle}> Configuración Completa</span>
            <span className={styles.actionDescription}>
              Gestionar todos los aspectos de tarifas
            </span>
          </div>
        </button>

        <button 
          className={styles.actionButton}
          onClick={handleNavigateToSeasonBlocks}
        >
          <span className={styles.actionIcon} aria-hidden="true"><FiCalendar /></span>
          <div className={styles.actionContent}>
            <span className={styles.actionTitle}> Gestionar Bloques</span>
            <span className={styles.actionDescription}>
              Crear y editar bloques de temporada
            </span>
          </div>
        </button>

        <button 
          className={styles.actionButton}
          onClick={handleNavigateToIntelligentPricing}
        >
          <span className={styles.actionIcon} aria-hidden="true"><FiCpu /></span>
          <div className={styles.actionContent}>
            <span className={styles.actionTitle}> Precios Inteligentes</span>
            <span className={styles.actionDescription}>
              Configurar algoritmos de precios
            </span>
          </div>
        </button>

        <button 
          className={styles.actionButton}
          onClick={handleNavigateToRatesCalendar}
        >
          <span className={styles.actionIcon} aria-hidden="true"><FiBarChart2 /></span>
          <div className={styles.actionContent}>
            <span className={styles.actionTitle}> Calendario de Tarifas</span>
            <span className={styles.actionDescription}>
              Ver y editar tarifas por fecha
            </span>
          </div>
        </button>
      </div>

      <div className={styles.cardFooter}>
        <small className={styles.helpText}>
          Haz clic en cualquier acción para acceder rápidamente
        </small>
      </div>
    </div>
  );
} 